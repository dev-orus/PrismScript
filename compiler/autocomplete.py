import jedi
import json
import sys
import compiler_prismscript
while True:
    data = json.loads(sys.stdin.readline())
    result = {}
    sp = data['source'].split('\n')
    if sp[data['line']][data['column']-2]!='#':
        script = jedi.Script(compiler_prismscript.compile(data['source'])[0])
        completions = script.complete(data['line']+1, data['column'])
        for completion in completions:
            result[completion.name] = {'type': completion.type}
        
    else:
        result = {'include': {'type': 'keyword'}}
    print(json.dumps(result))
    sys.stdout.flush()