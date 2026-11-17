import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'hooks'))
spec = importlib.util.spec_from_file_location('visual', ROOT / 'hooks/visual.py')
visual = importlib.util.module_from_spec(spec)
spec.loader.exec_module(visual)


class GraphTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'example'
        self.root.mkdir()
        self.env = patch.dict(os.environ, {'LEARN_DIR': str(Path(self.temp.name) / 'learning'), 'LEARN_ENABLED': '1'})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def write(self, path, text):
        dest = self.root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding='utf-8')
        return dest

    def test_links_evidence_and_incremental_changes(self):
        self.write('src/ui.tsx', "import {login} from './api/login.js';\nexport const App = () => login();")
        self.write('src/api/login.ts', "import {save} from '../db/users.js';\nexport async function login(data) { return await save(data); }")
        self.write('src/db/users.ts', 'export const save = async data => data;')
        first = visual.refresh(self.root)
        self.assertEqual(len(first['links']), 2)
        self.assertEqual(first['stats']['parsed'], 3)
        self.assertEqual({n['role'] for n in first['nodes']}, {'ui', 'api', 'data'})
        again = visual.refresh(self.root)
        self.assertEqual(again['stats']['parsed'], 0)
        self.assertEqual(again['stats']['cached'], 3)
        self.assertEqual(again['updated'], first['updated'])
        self.write('src/db/users.ts', 'export const save = async data => { return data; };')
        changed = visual.refresh(self.root)
        self.assertEqual(changed['stats']['parsed'], 1)
        self.assertEqual(changed['focus'], ['src/db/users.ts'])
        self.assertEqual(changed['budget']['modelCalls'], 0)
        self.assertEqual(changed['budget']['injectedBytes'], 0)
        self.assertIsNone(changed['budget']['wholeTaskOverhead'])

    def test_deleted_files_remove_stale_edges(self):
        self.write('a.js', "import './b.js';")
        b = self.write('b.js', 'export const n=1;')
        self.assertEqual(len(visual.refresh(self.root)['links']), 1)
        b.unlink()
        data = visual.refresh(self.root)
        self.assertEqual(data['links'], [])
        self.assertEqual([n['path'] for n in data['nodes']], ['a.js'])

    def test_comments_and_example_strings_are_not_imports(self):
        source = '''// import './wrong1';
/* import './wrong2'; */
const example = "import './wrong3';";
const template = `import './wrong4';`;
import { something } from './right';
export { x } from './exported';
const common = require('./common');
import('./dynamic');
'''
        self.assertEqual([i['spec'] for i in visual.js_imports(source)], ['./right', './exported', './common'])

    def test_python_relative_imports(self):
        self.write('app/api.py', 'from .service import run\n\ndef main():\n    return run()\n')
        self.write('app/service.py', 'def run():\n    return 1\n')
        data = visual.refresh(self.root)
        self.assertEqual(data['links'][0]['target'], 'app/service.py')
        self.assertEqual(data['links'][0]['line'], 1)

    def test_unresolved_aliases_are_not_guessed(self):
        self.write('a.ts', "import {x} from '@/service';")
        self.write('service.ts', 'export const x=1;')
        data = visual.refresh(self.root)
        self.assertEqual(data['links'], [])
        self.assertEqual(data['stats']['unresolved'], 1)

    def test_skips_notes_dependencies_and_privacy_markers(self):
        self.write('notes.md', 'privacy: no-ai\nDo not process this note.')
        self.write('node_modules/package/a.js', 'export const x=1;')
        self.write('venv/a.py', 'private = True')
        self.write('.hidden/a.py', 'private = True')
        self.write('credentials.py', 'private = True')
        self.write('private.py', '# privacy: no-ai\nx=1')
        self.write('public.py', 'x=1')
        data = visual.refresh(self.root)
        self.assertEqual([n['path'] for n in data['nodes']], ['public.py'])

    def test_key_like_string_skips_only_that_file(self):
        self.write('fixture.py', 'TOKEN = "ghp_' + 'a' * 30 + '"\n')
        self.write('public.py', 'x=1')
        data = visual.refresh(self.root)
        self.assertEqual([n['path'] for n in data['nodes']], ['public.py'])
        self.assertEqual(data['stats']['skipped'], 1)

    def test_source_snippets_have_exact_lines(self):
        self.write('service.ts', 'export async function run() {\n  const result = await fetch("/data");\n  return result;\n}\n')
        n = visual.refresh(self.root)['nodes'][0]
        excerpt = n['excerpts'][0]
        self.assertEqual(excerpt['highlight'], 2)
        self.assertIn('await fetch', excerpt['lines'][excerpt['highlight']-excerpt['line']])

    def test_no_llm_or_subagent_hooks_configured(self):
        hooks = json.loads((ROOT/'hooks/hooks.json').read_text())['hooks']
        self.assertEqual(hooks, {})
        for groups in hooks.values():
            for group in groups:
                for hook in group['hooks']:
                    self.assertEqual(hook['type'], 'command')
                    self.assertIn('visual.py', hook['command'])
                    self.assertNotIn('teach.py', hook['command'])

    def test_practice_accepts_equivalent_expression_and_explains_failure(self):
        example = visual.practice_example('def doubled(x):\n    return x * 2\n')
        self.assertTrue(visual.check_practice(example, 'x + x')['passed'])
        failed = visual.check_practice(example, 'x + 2')
        self.assertFalse(failed['passed'])
        self.assertIn('arguments', failed['case'])
        self.assertNotEqual(failed['actual'], failed['case']['result'])

    def test_practice_never_runs_calls_attributes_or_imports(self):
        example = visual.practice_example('def doubled(x):\n    return x * 2\n')
        for answer in ('__import__("os").getcwd()', 'x.__class__', '[x for x in range(10)]', '2 ** 99999999', 'x' * 241):
            self.assertFalse(visual.check_practice(example, answer)['passed'])
        self.assertIsNone(visual.practice_example('def fetch(x):\n    return client.get(x)\n'))
        self.assertIsNone(visual.practice_example('def change(x):\n    log(x)\n    return x * 2\n'))
        self.assertIsNone(visual.practice_example('def join(x: str):\n    return x + x\n'))
        self.assertIsNone(visual.practice_example('def always(x):\n    return x * 0\n'))
        negative = visual.practice_example('def threshold(x):\n    return x > -18\n')
        self.assertFalse(visual.check_practice(negative, 'True')['passed'])

    def test_practice_reference_is_an_actual_source_expression(self):
        self.write('logic.py', 'def allowed(age):\n    return age >= 18\n')
        node = visual.refresh(self.root)['nodes'][0]
        self.assertEqual(node['practice']['expression'], 'age >= 18')
        self.assertEqual(node['practice']['line'], 2)
        self.assertEqual(node['practice']['function'], 'allowed')
        self.assertFalse(visual.check_practice(node['practice'], 'False')['passed'])
        self.assertTrue(any(c['arguments']['age']==18 for c in node['practice']['cases']))

    def test_provider_requires_an_import_and_does_not_invent_entra(self):
        node = visual.parse_source('auth.ts', "import { jwtVerify } from 'jose';\n// Supabase and Entra ID\n")
        self.assertEqual(node['providers'], [])
        node = visual.parse_source('db.ts', "import {createClient} from '@supabase/supabase-js';")
        self.assertEqual(node['providers'][0]['label'], 'Supabase')

    def test_new_parser_invalidates_same_content_cache(self):
        self.write('a.py', 'def double(x):\n    return x * 2\n')
        data = visual.refresh(self.root)
        data['nodes'][0].pop('parserVersion')
        data['nodes'][0].pop('practice')
        file = visual.base_dir() / 'projects' / (data['id'] + '.json')
        visual.atomic_json(file, data)
        refreshed = visual.refresh(self.root)
        self.assertEqual(refreshed['stats']['parsed'], 1)
        self.assertIsNotNone(refreshed['nodes'][0]['practice'])


if __name__ == '__main__':
    unittest.main()
