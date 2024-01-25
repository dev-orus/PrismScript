import re
# import jedi

keywords = [
    'for',
    'while',
    'if',
    'elif',
    'else',
    'class',
    'def',
    'with',
    'try',
    'except',
    'finally'
]

typeKeyWords = [
    'str',
    'dict'
]

endCode = """"""

class PrismScriptError:
    def __init__(self, message, extra_info):
        self.extra_info = extra_info
        super().__init__(message)

def phase(string, index):
    split_string = string.split('\n')
    x = 0
    z = 0
    for i in range(len(split_string)):
        for y in range(len(split_string[i])):
            if x==index:
                z = i
                break
            else:
                x+=1
        x+=1
    return z

def getFuncCall(input_string:str):
    patternLeft = re.compile(r'<<\s*("[^"]*"|\'[^\']*\'|\w+)(?=(?:[^"\']*["\'][^"\']*["\'])*[^"\']*$)')
    patternMiddle = re.compile(r'<>\s*("[^"]*"|\'[^\']*\'|\w+)(?=(?:[^"\']*["\'][^"\']*["\'])*[^"\']*$)')
    patternRight = re.compile(r'>>\s*("[^"]*"|\'[^\']*\'|\w+)(?=(?:[^"\']*["\'][^"\']*["\'])*[^"\']*$)')
    matchesMiddle = patternMiddle.findall(input_string)
    matchesLeft = patternLeft.findall(input_string)+matchesMiddle
    matchesRight = patternRight.findall(input_string)+matchesMiddle
    funcName = input_string.split('<<')[0].rstrip()
    if '>>' in funcName:
        funcName = input_string.split('>>')[0].rstrip(' ')
    if '>' in funcName or '<' in funcName:
        funcName =  input_string.split('<>')[0].rstrip(' ')
    return f'{", ".join(matchesRight)} {"=" if matchesRight else ""} {funcName+"("+", ".join(matchesLeft)+")" if funcName else ""};'

def remove_brackets(input_str) -> str:
    result = ''
    inside_string = False
    is_var = 0
    is_json = 0
    inside_c = 0
    comment = False
    igi = 0
    for i in range(len(input_str)):
        char = input_str[i]
        if igi==0:
            if not comment and char == '=' and not inside_string:
                result += char
                is_var += 1
            elif not comment and char == '"' or char == "'":
                if is_var and inside_string and not is_json:
                    try:
                        if input_str[i+1]+input_str[i+2]+input_str[i+3] in ['"""', "'''"]:
                            igi=3
                    except IndexError:
                        pass
                    is_var -= 1
                inside_string = not inside_string
                result += char
            elif not inside_c and not comment and not is_json and not inside_string and not is_var and char == '{':
                continue
            elif not inside_c and not comment and not is_json and not inside_string and not is_var and char == '}':
                igi = countSpc(input_str[i+1:])
                continue
            elif not comment and char=='(' and not inside_string:
                result += char
                inside_c += 1
            elif not comment and char==')' and not inside_string:
                result += char
                inside_c -= 1
            elif not comment and is_var and char=='{' and not inside_string:
                result += char
                is_json += 1
            elif not comment and is_var and char=='[' and not inside_string:
                result += char
                is_json += 1
            elif not comment and is_json and is_var and char=='}' and not inside_string:
                result += char
                is_var = 0
                is_json -= 1
            elif not comment and is_json and is_var and char==']' and not inside_string:
                result += char
                is_var = 0
                is_json -= 1
            elif not comment and char==';' and not inside_string and not is_json:
                inside_string = False
                is_var = 0
                is_json = False
                igi = 0
                result += char
            elif char=='/' and input_str[i+1]=='/' and not inside_c and not comment and not inside_string:
                comment = True
                result+='#'
                igi = 1
            elif char==':' and input_str[i+1]==':' and not comment and not inside_string:
                result+='.'
                igi = 1
            elif char=='#' and not is_json and not is_var and not inside_string and not comment:
                result += '$#'
            elif char=='\n':
                comment = False
                result += char
            else:
                result += char
        else: igi-=1
    return result

def countSpc(string):
    out = 0
    for i in string:
        if i==' ':
            out+=1
        else:break
    return out

def getAll(input_str):
    result = []
    inside_string = False
    is_var = 0
    is_json = False
    comment = False
    problems = []
    igi = 0
    for i in range(len(input_str)):
        char = input_str[i]
        if igi==0:
            if not comment and char == '=' and not inside_string:
                is_var += 1
            elif not comment and char == '"' or char == "'":
                if is_var and inside_string and not is_json:
                    if input_str[i+1]+input_str[i+2]+input_str[i+3] in ['"""', "'''"]:
                        igi=3
                    is_var -= 1
                inside_string = not inside_string
            elif not comment and not is_json and not inside_string and not is_var and char == '{':
                continue
            elif not comment and not is_json and not inside_string and not is_var and char == '}':
                igi = countSpc(input_str[i+1:])
                continue
            elif not comment and is_var and char=='{' and not inside_string:
                is_json = True
            elif not comment and is_var and char=='[' and not inside_string:
                is_json = True
            elif not comment and is_json and is_var and char=='}' and not inside_string:
                is_var = 0
                is_json = False
            elif not comment and is_json and is_var and char==']' and not inside_string:
                is_var = 0
                is_json = False
            elif not comment and char==';' and not inside_string and not is_json:
                inside_string = False
                is_var = 0
                is_json = False
                igi = 0
            elif char=='/' and input_str[i+1]=='/' and not comment and not inside_string:
                comment = True
                igi = 1
            elif char=='\n':
                comment = False
            elif char=='<' and input_str[i+1]=='<' and not comment and not inside_string:
                result.append(phase(input_str, i))
            elif char=='>' and input_str[i+1]=='>' and not comment and not inside_string:
                result.append(phase(input_str, i))
            elif char=='<' and input_str[i+1]=='>' and not comment and not inside_string:
                result.append(phase(input_str, i))
        else: igi-=1
    return result
            

def compile(code):
    psModules = []
    def pushToModules(x:str):
        psModules.append(x)
        return x.removesuffix('.ps')
    code = remove_brackets(code)
    phases = getAll(code)
    tokenList:list[str] = code.split('\n')
    tokenOut = []
    strMode = False
    errors = []
    for i in range(len(tokenList)):
        tkn = tokenList[i]
        token = tkn.strip(' ')
        token_ = tkn.split(' ')
        _token_ = token.split(' ')
        if i in phases and token.strip(' ')!='':
            tokenOut.append((' ' * countSpc(tkn))+getFuncCall(token).strip())
            continue
        elif token.startswith('$#'):
            if token.removeprefix('$#').lstrip().startswith('include'):
                modules = re.findall(r'<(.*?)>', token)
                modules = [pushToModules(x) if x.endswith('.ps') else x for x in modules]
                tokenOut.append('import '+', '.join(modules))
        elif _token_[0]=='fn':
            tokenOut.append((' ' * countSpc(tkn))+'def '+token.removeprefix(_token_[0]).strip()+':')
        elif str(_token_[0]) in keywords:
            tokenOut.append(str(tkn).rstrip(' ')+':')
        elif any(token.startswith(x) for x in typeKeyWords):
            tokenOut.append((' ' * countSpc(tkn))+token.removeprefix(_token_[0]).strip())
        elif '"' in token:
            if token.count('"') % 2 != 0:
                strMode = not strMode
            tokenOut.append(tkn)
        elif "'" in token:
            if token.count("'") % 2 != 0:
                strMode = not strMode
            tokenOut.append(tkn)
        else:
            tokenOut.append(tkn)
    outputCode = '\n'.join(tokenOut).strip()
    # script = jedi.Script(outputCode)
    return [outputCode, psModules]
    # else:
        # return (PrismScriptError, "function 'main' or 'module' does not exist")