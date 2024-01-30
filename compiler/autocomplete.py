import os
import sys
try:
    import jedi
    from flask import Flask
    from flask_socketio import SocketIO
except:
    os.system(f'{sys.executable} -m pip install jedi flask flask-socketio')
    import jedi
    from flask import Flask
    from flask_socketio import SocketIO
import compiler_prismscript
from json import loads, dumps
import re

app = Flask(__name__)
socketio = SocketIO(app)

parent = os.path.join(os.path.dirname(__file__), 'python')
if not os.path.exists(parent):
    os.mkdir(parent)

@socketio.on('ac')
def complete(data):
    data = loads(data)
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
            # if completion.type=='function':
            #     m = re.search(r'\(([^()]+)\)', completion.get_line_code())
            #     params = str(m.group(1) if m else '')
            #     if completion.name == 'print':
            #         params = 'values, sep, end, file, flush'
            #     result[completion.name] = {'type': completion.type, 'doc': completion.docstring(), 'params': params}
            # else:
            result[completion.name] = {'type': completion.type, 'doc': completion.docstring(), 'params': ''}
    else:
        result = {'include': {'type': 'keyword'}}
    socketio.emit('msg', dumps(result))

if __name__=='__main__':
    socketio.run(app, port=6921, allow_unsafe_werkzeug=True)