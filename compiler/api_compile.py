import compiler_prismscript
import json
import sys

while True:
    x = compiler_prismscript.compile(sys.stdin.readline().replace('\\n', '\n'))
    print(json.dumps({'error': x[1], 'output': x[0]}))
    sys.stdout.flush()