"""Restricted numeric practice: source selection and feedback, no code execution."""
import ast
import itertools
import operator


def expression_value(source, arguments):
    """Interpret a small numeric expression, never execute project/user code."""
    if len(source) > 240:
        raise ValueError('Expression too long')
    tree = ast.parse(source, mode='eval')
    if sum(1 for _ in ast.walk(tree)) > 48:
        raise ValueError('Expression too complex')
    binary = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
              ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod}
    compare = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt,
               ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge}

    def read(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float, bool, type(None)):
            value = node.value
        elif isinstance(node, ast.Name) and node.id in arguments:
            value = arguments[node.id]
        elif isinstance(node, ast.BinOp) and type(node.op) in binary:
            value = binary[type(node.op)](read(node.left), read(node.right))
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.Not, ast.USub, ast.UAdd)):
            value = {ast.Not: operator.not_, ast.USub: operator.neg, ast.UAdd: operator.pos}[type(node.op)](read(node.operand))
        elif isinstance(node, ast.Compare):
            left = read(node.left)
            value = True
            for op, right_node in zip(node.ops, node.comparators):
                if type(op) not in compare:
                    raise ValueError('Unsupported comparison')
                right = read(right_node)
                if not compare[type(op)](left, right):
                    value = False
                    break
                left = right
        elif isinstance(node, ast.BoolOp):
            value = read(node.values[0])
            for item in node.values[1:]:
                if isinstance(node.op, ast.And) and not value or isinstance(node.op, ast.Or) and value:
                    break
                value = read(item)
        elif isinstance(node, ast.IfExp):
            value = read(node.body if read(node.test) else node.orelse)
        else:
            raise ValueError('Only numeric expressions, comparisons and boolean logic are supported')
        if type(value) not in (int, float, bool, type(None)) or (isinstance(value, (int, float)) and not abs(value) < 10**12):
            raise ValueError('Result outside exercise limits')
        return value
    return read(tree.body)


def practice_example(text):
    """Select a standalone, side-effect-free numeric return expression."""
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return None
    for function in tree.body:
        if not isinstance(function, ast.FunctionDef) or function.decorator_list:
            continue
        body = [n for n in function.body if not isinstance(n, ast.Expr) or not isinstance(n.value, ast.Constant) or not isinstance(n.value.value, str)]
        args = function.args
        names = [a.arg for a in args.posonlyargs + args.args]
        if any(a.annotation and (not isinstance(a.annotation, ast.Name) or a.annotation.id not in ('int', 'float')) for a in args.posonlyargs + args.args):
            continue
        if len(body) != 1 or not isinstance(body[0], ast.Return) or not body[0].value or not 1 <= len(names) <= 2 or any(len(n)>40 for n in names) or args.vararg or args.kwarg or args.kwonlyargs:
            continue
        expression = ast.get_source_segment(text, body[0].value)
        if not expression or '\n' in expression or not any(isinstance(n, (ast.BinOp, ast.Compare, ast.BoolOp, ast.IfExp)) for n in ast.walk(body[0].value)):
            continue
        if body[0].end_lineno-function.lineno > 7:
            continue
        values = {-3, -1, 0, 1, 2, 4, 8}
        for constant in ast.walk(body[0].value):
            if isinstance(constant, ast.Constant) and type(constant.value) in (int, float) and abs(constant.value)<1000000:
                values.update((constant.value-1, constant.value, constant.value+1))
            if isinstance(constant, ast.UnaryOp) and isinstance(constant.op, ast.USub) and isinstance(constant.operand, ast.Constant) and type(constant.operand.value) in (int, float) and abs(constant.operand.value)<1000000:
                values.update((-constant.operand.value-1, -constant.operand.value, -constant.operand.value+1))
        values = sorted(values)[:15]
        cases = []
        try:
            for combination in itertools.product(values, repeat=len(names)):
                arguments = dict(zip(names, combination))
                try:
                    result = expression_value(expression, arguments)
                    cases.append({'arguments': arguments, 'result': result})
                except ZeroDivisionError:
                    continue
        except (ValueError, TypeError, SyntaxError):
            continue
        if len(cases) >= 5 and len({(type(c['result']).__name__, str(c['result'])) for c in cases}) > 1:
            return {'function': function.name, 'parameters': names, 'line': body[0].lineno,
                    'expression': expression, 'cases': cases,
                    'code': text.splitlines()[function.lineno-1:body[0].end_lineno]}
    return None


def check_practice(example, answer):
    for case in example['cases']:
        try:
            result = expression_value(answer, case['arguments'])
        except (ValueError, TypeError, SyntaxError, ZeroDivisionError) as error:
            return {'passed': False, 'reason': str(error)[:160], 'case': case}
        if type(result) != type(case['result']) or result != case['result']:
            return {'passed': False, 'actual': result, 'case': case}
    return {'passed': True, 'tested': len(example['cases'])}
