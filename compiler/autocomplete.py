import os
import sys
try:
    import jedi
except:
    os.system(f'{sys.executable} -m pip install jedi')

import json
import compiler_prismscript

parent = os.path.join(os.path.dirname(__file__), 'python')
if not os.path.exists(parent):
    os.mkdir(parent)

while True:
    data = json.loads(sys.stdin.readline())
    result = {}
    sp = data['source'].split('\n')
    if sp[data['line']][data['column']-1]+sp[data['line']][data['column']-2]=='::':
        data['column'] -= 1
    if sp[data['line']][data['column']-2]!='#':
        [pyCode, modules] = compiler_prismscript.compile(data['source'])
        if data['dir']:
            for m in modules:
                with open(os.path.join(data['dir'], str(m)))as z:
                    with open(os.path.join(parent, str(m).removesuffix('.ps')+'.py'), 'w')as f:
                        f.write(compiler_prismscript.compile(z.read())[0])
            script = jedi.Script(pyCode, path=os.path.join(parent, 'main.py'))
        else:
            script = jedi.Script(pyCode, path=os.path.join(parent, 'main.py'))
        completions = script.complete(data['line']+1, data['column'])
        for completion in completions:
            result[completion.name] = {'type': completion.type}
        
    else:
        result = {'include': {'type': 'keyword'}}
    print(json.dumps(result))
    sys.stdout.flush()