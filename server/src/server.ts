/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionList,
  RequestHandler,
  TextDocumentChangeEvent,
  WorkspaceFolder,
} from "vscode-languageserver/node";
import * as vscode from "vscode";

import { checkCode, errList } from "./problemChecker";
import { TextDocument } from "vscode-languageserver-textdocument";
import { existsSync, readFileSync, write } from "fs";
import { exec, execSync, spawn } from "child_process";
import { dirname, join } from "path";
import { TIMEOUT } from 'dns';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {});
  }
});

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <ExampleSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "languageServerExample",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

var envDir = join(dirname(dirname(__dirname)), "compiler", "venv");
var compileDir = join(
  dirname(dirname(__dirname)),
  "compiler",
  "api_compile.py"
);
var autocompleteDir = join(
  dirname(dirname(__dirname)),
  "compiler",
  "autocomplete.py"
);
var pipDir = "";
var pyDir = "";

function gdir() {
  // const pythonConfig = vscode.workspace.getConfiguration('python');
  // const interpreterPath = pythonConfig.get<string>('pythonPath');
  // console.log(interpreterPath);
  if (existsSync(join(envDir, "bin"))) {
    if (existsSync(join(envDir, "bin", "python"))) {
      pyDir = join(envDir, "bin", "python");
      pipDir = join(envDir, "bin", "pip");
    } else {
      pyDir = join(envDir, "bin", "python3");
      pipDir = join(envDir, "bin", "pip3");
    }
  } else if (existsSync(join(envDir, "scripts"))) {
    if (existsSync(join(envDir, "scripts", "python"))) {
      pyDir = join(envDir, "scripts", "python");
      pipDir = join(envDir, "scripts", "pip");
    } else {
      pyDir = join(envDir, "scripts", "python3");
      pipDir = join(envDir, "scripts", "pip3");
    }
  }
}

if (!existsSync(envDir)) {
  exec(`python3 -m venv ${envDir}`, (error, stdout, stderr) => {
    if (error) {
      exec(`python -m venv ${envDir}`, (error, stdout, stderr) => {
        gdir();
        try {
          execSync(`${pipDir} install jedi-language-server`);
        } finally {
        }
      });
    }
    gdir();
    try {
      execSync(`${pipDir} install jedi-language-server`);
    } finally {
    }
  });
}

gdir();

const compilerProceess = spawn(pyDir, [compileDir], {
  stdio: ["pipe", "pipe", "pipe"],
});
var jediProceess = spawn(pyDir, [autocompleteDir], {
  stdio: ["pipe", "pipe", "pipe"],
});
compilerProceess.stderr.on("data", (data) => {
  console.error(`Error from Python-PrismScript Compiler: ${data.toString()}`);
});
jediProceess.stderr.on("data", (data) => {
  console.error(`Error from Python-PrismScript Jedi: ${data.toString()}`);
});
compilerProceess.on("close", (c) => {});
jediProceess.on("close", (c) => {});

type compileOutType = [errList, string];

function getCompletions(code: string, ln: number, col: number): Promise<any> {
  jediProceess.stdin.write(
    JSON.stringify({ source: code.trim(), line: ln, column: col }) + "\n"
  );
  return new Promise((resolve) => {
    jediProceess.stdout.once("data", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        console.error(e);
        resolve({});
      }
    });
  });
}

var workspaceFolder = "";

setInterval(() => {
  let psconfigPath = join(workspaceFolder, "psconfig.json");
  if (existsSync(psconfigPath)) {
    try {
      let data = JSON.parse(readFileSync(psconfigPath).toString());
      if (data) {
        if (data.env && data.env !== envDir) {
          envDir = join(workspaceFolder, data.env);
          gdir();
          exec(`${pipDir} show jedi`, (err, stdout, stderr) => {
            if (err) {
              exec(`${pipDir} install jedi`, (err, stdout, stderr) => {});
            }
          });
          jediProceess.kill();
          jediProceess = spawn(pyDir, [autocompleteDir], {
            stdio: ["pipe", "pipe", "pipe"],
          });
        }
      }
    } catch {}
  }
}, 3000);

function compile(codeIn: string): Promise<compileOutType> {
  // console.log(codeIn.replace("\n", "\\n"));
  compilerProceess.stdin.write(codeIn.replace("\n", "\\n") + "\n");
  return new Promise((resolve) => {
    compilerProceess.stdout.once("data", (data) => {
      let x = data.toString().trim(" ").split("\n");
      let jsonData: { error: Array<string> | []; output: string } = JSON.parse(
        x[x.length - 1].toString()
      );
      let errOut: errList = {
        problems: [],
        errCount: 0,
        warnCount: 0,
        infoCount: 0,
      };
      if (jsonData.error.length > 0) {
        errOut.errCount = jsonData.error.length;
        errOut.problems = jsonData.error;
      }
      resolve([errOut, jsonData.output]);
    });
  });
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  const text = textDocument.getText();
  let problems: errList = {
    problems: [],
    errCount: 0,
    warnCount: 0,
    infoCount: 0,
  };
  let pyCode = "";
  let tempFilePath;
  [problems, pyCode] = await compile(text);
  // [tempFilePath, problems] = await checkCode(pyCode);
  // unlinkSync(tempFilePath);
  const diagnostics: Diagnostic[] = [];
  for (
    var i = 0;
    i < settings.maxNumberOfProblems && i < problems.problems.length;
    i++
  ) {
    let problem = problems.problems[i];
    const diagnostic: Diagnostic = {
      severity:
        problem["type"] === "warn"
          ? DiagnosticSeverity.Warning
          : DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(problem.ln),
        end: textDocument.positionAt(problem.col),
      },
      message: problem.msg,
      source: "pyright",
    };
    diagnostics.push(diagnostic);
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {});

connection.onCompletion(
  async (
    params
  ): Promise<CompletionItem[] | CompletionList | null | undefined> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null; // or undefined, depending on your desired behavior
    }

    const position = params.position;
    try {
      let completionsRaw = await getCompletions(
        document.getText(),
        position.line,
        position.character
      );

      let completions: CompletionItem[] = Object.keys(completionsRaw).map(
        (label): CompletionItem => {
          switch (completionsRaw[label]["type"]) {
            case "keyword":
              return { label, kind: CompletionItemKind.Keyword };
            case "module":
              return { label, kind: CompletionItemKind.Module };
            case "function":
              return { label, kind: CompletionItemKind.Function };
            case "statement":
              return { label, kind: CompletionItemKind.Variable };
            case "class":
              return { label, kind: CompletionItemKind.Class };
            default:
              return { label, kind: CompletionItemKind.Text };
          }
        }
      );

      return completions;
    } catch (error) {
      console.error("Error while getting completions:", error);
      return null; // or undefined, depending on your desired behavior
    }
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders) {
    let wkpath = params.workspaceFolders[0].uri;
    if (params.workspaceFolders[0].uri.startsWith("file://")) {
      wkpath = params.workspaceFolders[0].uri.substring(7);
    }
    workspaceFolder = wkpath;
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [".", "#", ":", ":"],
      },
    },
  };
});

documents.listen(connection);
connection.listen();
