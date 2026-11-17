"""Local static learning graph. No model calls, prompt injection, or transcript reads."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from practice import practice_example, check_practice

PARSER_VERSION = 2


EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'}
SKIP = {'node_modules', 'vendor', 'dist', 'build', 'coverage', '__pycache__',
        'venv', 'env', 'target', 'outputs', 'work', 'Ideaverse', 'AI-Workbench'}
MAX_FILES = 2000
MAX_BYTES = 64_000
CONCEPTS = [
    ('guard', r'\bthrow\s+new\s+(?:Error|TypeError|RangeError)\b', 'Stop an invalid operation',
     'Throw exits the normal path. Check which caller handles this error and what happens to work already performed.'),
    ('validation', r'\b(?:safeParse|validate\w*|isValid\w*)\s*\(', 'Validate at the boundary',
     'Check input before passing it deeper into the system. A validation call is a clue; inspect its implementation and failure path.'),
    ('errors', r'\bcatch\s*(?:\(|\{)|^\s*except\b', 'Handle failure explicitly',
     'This branch handles an error. Check what the caller receives and whether the original cause remains visible.'),
    ('async', r'\bawait\b', 'Waiting without blocking',
     'Await waits for a result before continuing this function. It does not itself prove that independent operations run in parallel.'),
    ('data', r'\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b|\.(?:query|execute|findUnique|findMany|save)\s*\(', 'The storage boundary',
     'This line appears to access stored data. Check how inputs reach it, how failures return, and where access is authorised.'),
    ('memory', r'\bnew\s+(?:Map|Set)\s*\(', 'Memory is not durable storage',
     'This collection lives in the running process. Restarting the process loses its contents unless other code persists and restores them.'),
]


def base_dir():
    if os.environ.get('LEARN_VISUAL_DIR'):
        return Path(os.environ['LEARN_VISUAL_DIR'])
    return Path(os.environ.get('LEARN_DIR') or Path.home() / '.learning') / 'visual'


def project_root(cwd):
    cwd = Path(cwd).resolve()
    try:
        r = subprocess.run(['git', '-C', str(cwd), 'rev-parse', '--show-toplevel'],
                           capture_output=True, text=True, timeout=2)
        if r.returncode == 0:
            return Path(r.stdout.strip()).resolve()
    except (OSError, subprocess.TimeoutExpired):
        pass
    return cwd


def allowed(path, root):
    try:
        relative = path.relative_to(root)
    except ValueError:
        return False
    return (path.suffix in EXTENSIONS and not path.is_symlink()
            and not any(p.startswith('.') or p in SKIP for p in relative.parts)
            and not re.search(r'(?:secret|credential|private[-_]?key)', path.name, re.I))


def source_paths(root):
    found = []
    for folder, directories, files in os.walk(root, followlinks=False):
        directories[:] = sorted(d for d in directories if not d.startswith('.')
                                and d not in SKIP and not (Path(folder) / d).is_symlink())
        for name in sorted(files):
            path = Path(folder) / name
            if allowed(path, root):
                found.append(path)
                if len(found) > MAX_FILES:
                    return found[:MAX_FILES], True
    return found, False


def role(path):
    p = path.lower()
    if re.search(r'(?:^|/)(?:db|database|models?|repositories)(?:/|\.)', p):
        return 'data'
    if re.search(r'(?:^|/)(?:api|routes?|controllers?)(?:/|\.)', p) or p.endswith('/route.ts'):
        return 'api'
    if p.endswith(('.tsx', '.jsx')) or re.search(r'(?:^|/)(?:web|frontend|components?|pages?)/', p):
        return 'ui'
    return 'logic'


def js_imports(text):
    # Token-level scan: comments and strings containing example imports are not code.
    pattern = r'''//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]'''
    tokens = [m for m in re.finditer(pattern, text) if not m[0].startswith(('//', '/*'))]
    found = []
    for i, token in enumerate(tokens):
        value = token[0]
        following = tokens[i + 1:i + 40]
        chosen = None
        if value in {'import', 'export'} and following and following[0][0] != '(':
            if value == 'import' and following[0][0].startswith(('"', "'")):
                chosen = following[0]
            else:
                for j, item in enumerate(following[:-1]):
                    if item[0] == ';':
                        break
                    if item[0] == 'from' and following[j + 1][0].startswith(('"', "'")):
                        chosen = following[j + 1]
                        break
        elif value == 'require' and len(following) >= 3 and following[0][0] == '(' and following[2][0] == ')':
            if following[1][0].startswith(('"', "'")):
                chosen = following[1]
        if chosen:
            found.append({'spec': chosen[0][1:-1], 'line': text.count('\n', 0, token.start()) + 1})
    return found


def parse_source(relative, text):
    lines = text.splitlines()
    imports = []
    parse_error = False
    if relative.endswith('.py'):
        try:
            tree = ast.parse(text)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imports.extend({'spec': n.name.replace('.', '/'), 'line': node.lineno,
                                    'python': True, 'level': 0} for n in node.names)
                elif isinstance(node, ast.ImportFrom):
                    imports.append({'spec': (node.module or '').replace('.', '/'),
                                    'line': node.lineno, 'python': True, 'level': node.level})
                    # `from . import sibling` names can themselves be local modules.
                    if not node.module:
                        imports.extend({'spec': n.name, 'line': node.lineno,
                                        'python': True, 'level': node.level} for n in node.names)
        except SyntaxError:
            parse_error = True
    else:
        imports = js_imports(text)
    concepts = []
    excerpts = []
    for key, pattern, title, explanation in CONCEPTS:
        match = re.search(pattern, text, re.M | re.I)
        if match:
            line = text.count('\n', 0, match.start()) + 1
            concepts.append({'id': key, 'title': title, 'explanation': explanation,
                             'line': line, 'evidence': 'pattern candidate'})
            excerpts.append({'line': max(1, line - 1), 'highlight': line,
                             'lines': [s[:240] for s in lines[max(0, line - 2):line + 2]], 'concept': key})
    if not excerpts and lines:
        match = re.search(r'^\s*(?:export\s+)?(?:async\s+)?(?:function|class|def)\s+|\b(?:GET|POST|PUT|DELETE)\s*=', text, re.M)
        line = text.count('\n', 0, match.start()) + 1 if match else (imports[0]['line'] if imports else 1)
        excerpts.append({'line': line, 'highlight': line, 'lines': [s[:240] for s in lines[line - 1:line + 3]], 'concept': 'boundary'})
    merged = []
    for excerpt in sorted(excerpts, key=lambda e: e['line']):
        excerpt['highlights'] = [excerpt['highlight']]
        if merged and excerpt['line'] <= merged[-1]['line'] + len(merged[-1]['lines']):
            previous = merged[-1]
            end = max(previous['line'] + len(previous['lines']), excerpt['line'] + len(excerpt['lines']))
            previous['lines'] = [s[:240] for s in lines[previous['line'] - 1:min(end - 1, previous['line'] + 7)]]
            previous['highlights'] += excerpt['highlights']
            previous['concept'] += ' + ' + excerpt['concept']
        else:
            merged.append(excerpt)
    providers = []
    for imp in imports:
        name = imp['spec']
        label = ('Supabase' if 'supabase' in name.lower() else
                 'Microsoft identity (MSAL)' if 'msal' in name.lower() else
                 'Azure Identity' if name.startswith(('azure/identity', '@azure/identity')) else None)
        if label:
            providers.append({'label': label, 'package': name, 'line': imp['line']})
    return {'path': relative, 'role': role(relative), 'imports': imports[:256],
            'parserVersion': PARSER_VERSION, 'providers': providers[:3],
            'practice': practice_example(text) if relative.endswith('.py') else None,
            'concepts': concepts[:2], 'excerpts': merged[:2], 'parseError': parse_error}


def resolve_import(path, imp, available):
    spec = imp['spec']
    current = Path(path).parent
    if imp.get('python'):
        if imp.get('level'):
            for _ in range(imp['level'] - 1):
                current = current.parent
            stem = (current / spec).as_posix()
        else:
            stem = spec
    elif spec.startswith('.'):
        stem = os.path.normpath(str(current / spec)).replace('\\', '/')
    else:
        return None  # Aliases and package resolution are not guessed.
    candidates = [stem]
    if stem.endswith(('.js', '.jsx', '.mjs')):
        stem = stem.rsplit('.', 1)[0]
    candidates += [stem + ext for ext in sorted(EXTENSIONS)]
    candidates += [stem.rstrip('/') + '/index' + ext for ext in sorted(EXTENSIONS)]
    candidates += [stem.rstrip('/') + '/__init__.py']
    return next((p for p in candidates if p in available and p != path), None)


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=True)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def refresh(root, focus=None, session=None, event_name=None):
    root = Path(root).resolve()
    ident = hashlib.sha256(os.path.normcase(str(root)).encode()).hexdigest()[:20]
    directory = base_dir() / 'projects'
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / (ident + '.lock')
    # Separate sessions share a lock; no model is asked to coordinate them.
    for _ in range(20):
        try:
            lock.mkdir()
            break
        except FileExistsError:
            if time.time() - lock.stat().st_mtime > 60:
                try:
                    lock.rmdir()
                except OSError:
                    pass
            time.sleep(.05)
    else:
        return None
    try:
        dest = directory / (ident + '.json')
        try:
            previous = json.loads(dest.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            previous = {}
        cached = {n['path']: n for n in previous.get('nodes', [])}
        paths, truncated = source_paths(root)
        nodes = []
        changed = []
        skipped = 0
        parsed = 0
        for path in paths:
            stat = path.stat()
            if stat.st_size > MAX_BYTES:
                skipped += 1
                continue
            relative = path.relative_to(root).as_posix()
            fingerprint = [stat.st_mtime_ns, stat.st_size]
            if relative in cached and cached[relative].get('parserVersion') == PARSER_VERSION and cached[relative].get('stat') == fingerprint:
                nodes.append(cached[relative])
                continue
            raw = path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            if relative in cached and cached[relative].get('parserVersion') == PARSER_VERSION and cached[relative]['digest'] == digest:
                node = cached[relative]
            else:
                text = raw.decode('utf-8', errors='replace')
                # Never cache source excerpts from explicitly excluded content.
                if re.search(r'privacy:\s*(?:tier-0|no-ai)', text, re.I):
                    skipped += 1
                    continue
                if re.search(r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-ant-|ghp_)[A-Za-z0-9_-]{20,}', text):
                    raise ValueError('Possible credential detected; stopped without caching this scan.')
                node = dict(parse_source(relative, text), digest=digest)
                parsed += 1
                changed.append(relative)
            node['stat'] = fingerprint
            nodes.append(node)
        available = {n['path'] for n in nodes}
        deleted = sorted(set(cached) - available)
        links = []
        unresolved = 0
        for node in nodes:
            for imp in node['imports']:
                target = resolve_import(node['path'], imp, available)
                if target:
                    links.append({'source': node['path'], 'target': target,
                                  'line': imp['line'], 'kind': 'imports', 'evidence': 'static import'})
                else:
                    unresolved += 1
        pending = previous.get('pending', [])
        if event_name == 'PostToolUse':
            pending = list(dict.fromkeys(pending + (focus or changed)))
        focus_paths = [p for p in (pending + changed if event_name == 'Stop' else focus or changed) if p in available]
        if not focus_paths:
            focus_paths = [p for p in previous.get('focus', []) if p in available]
        initial = not previous
        history = previous.get('history', [])
        if changed or deleted:
            history = [{'at': time.time(), 'changed': changed, 'deleted': deleted,
                        'initial': initial, 'session': session}] + history[:19]
        sessions = previous.get('sessions', {})
        if session:
            sessions[hashlib.sha256(session.encode()).hexdigest()[:10]] = time.time()
        sessions = {s: t for s, t in sessions.items() if time.time() - t < 24 * 3600}
        data = {'schema': 1, 'id': ident, 'name': root.name, 'root': str(root),
                'updated': time.time() if changed or deleted or initial else previous['updated'], 'nodes': nodes, 'links': links,
                'focus': focus_paths, 'pending': [] if event_name == 'Stop' else pending,
                'history': history, 'sessions': sessions,
                'stats': {'parsed': parsed, 'cached': len(nodes) - parsed,
                          'unresolved': unresolved, 'truncated': truncated, 'skipped': skipped},
                'budget': {'modelCalls': 0, 'injectedBytes': 0,
                           'mode': 'local-only', 'wholeTaskOverhead': None}}
        atomic_json(dest, data)
        summary = {k: v for k, v in data.items() if k not in {'nodes', 'links', 'history', 'pending'}}
        atomic_json(directory / (ident + '.meta.json'), summary)
        return data
    finally:
        lock.rmdir()


def hook(event):
    if os.environ.get('LEARN_ENABLED', '1') == '0' or not isinstance(event, dict):
        return
    if event.get('agent_id') or event.get('agent_type') or '/subagents/' in str(event.get('transcript_path', '')).replace('\\', '/'):
        return
    if event.get('hook_event_name') not in {'SessionStart', 'PostToolUse', 'Stop'} or not event.get('cwd'):
        return
    # Never read transcript_path, prompts, tool results, or assistant output.
    root = project_root(event['cwd'])
    incoming = (event.get('tool_input') or {}).get('file_path')
    focus = None
    if incoming:
        try:
            target = Path(incoming)
            if not target.is_absolute():
                target = Path(event['cwd']) / target
            focus = [target.resolve().relative_to(root).as_posix()]
        except ValueError:
            pass
    refresh(root, focus=focus, session=event.get('session_id'), event_name=event['hook_event_name'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['hook', 'scan', 'practice'])
    parser.add_argument('root', nargs='?')
    args = parser.parse_args()
    if os.environ.get('LEARN_ENABLED', '1') == '0':
        return
    if args.command == 'practice':
        request = json.loads(sys.stdin.read(65536))
        example = request.get('example')
        # Host supplies the indexed reference; no file paths or executable code.
        print(json.dumps(check_practice(example, request.get('answer', ''))))
        return
    if args.command == 'hook':
        try:
            event = json.load(sys.stdin)
        except ValueError:
            return
        try:
            hook(event)
        except Exception as error:
            # Errors stay local; sending stderr to the agent would waste tokens.
            dest = base_dir() / 'status.json'
            atomic_json(dest, {'at': time.time(), 'error': str(error)[:200]})
    else:
        data = refresh(project_root(args.root or os.getcwd()))
        if data:
            print(json.dumps({'project': data['name'], 'files': len(data['nodes']),
                              'links': len(data['links']), 'stats': data['stats']}))


if __name__ == '__main__':
    main()
