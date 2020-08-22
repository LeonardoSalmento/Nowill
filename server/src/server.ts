
const patterns: string[] = [
	"<img (?:.)+?>",
	"<input (?:.)+?>",
	"<a(?:.)+?>(?:.)+?<\/a>",
	"<body(?:(?:\\s|\\S|))+?>",
	"<html(?:(?:\\s|\\S|))+?>",
	"<form(?:(?:\\s|\\S|))+?>",
	"<audio(?:(?:\\s|\\S|))+?>",
	"<video(?:(?:\\s|\\S|))+?>",
	"<iframe(?:(?:\\s|\\S|))+?>",
	"<v-img(?:(?:\\s|\\S|))+?>",	
	"<head>(?:(?:\\s|\\S|)+?(?=<\/head>))<\/head>"
	
];
export const pattern: RegExp = new RegExp(patterns.join('|'), 'ig');

let listBadDescritivesA: Array<string> = [
	"aqui",
	"mais",
	"veja mais",
	"leia mais",
	"saiba mais",
	"clique aqui",
	"acesse aqui",
	"veja a lista",
	"acesse a lista",
	"veja a lista aqui"];

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams
} from 'vscode-languageserver';

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

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

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			completionProvider: {
				resolveProvider: true
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface NowillSettings {
	maxNumberOfProblems: number;
}

const defaultSettings: NowillSettings = { maxNumberOfProblems: 100 };
let globalSettings: NowillSettings = defaultSettings;

let documentSettings: Map<string, Thenable<NowillSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = <NowillSettings>(
			(change.settings.nowill || defaultSettings)
		);
	}

	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<NowillSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'nowill'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let settings = await getDocumentSettings(textDocument.uri);

	let text = textDocument.getText();
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		let el = m[0].slice(0, 5);
		connection.console.log(el);
		switch(true){
			// 4.1 * Contraste entre plano de fundo e primeiro plano
			case(/<body/i.test(el)):
				if (/background="(?:.*?[a-z].*?)"/i.test(m[0])){
					problems++;
					let message = 'A página não deve conter um background que dificulte a leitura do texto';
					_diagnostics(m, message, 2);
				}
				break;

			//3.6 * Alternativa de texto para imagens
			case ((/<img/i.test(el)) || (/<v-im/i.test(el))):
				if ((!/alt="(?:.*?[a-z].*?)"/i.test(m[0])) && (!/alt=""/i.test(m[0]))) {
					problems++;
					let message = 'Insira um texto que descreva a imagem, ou [alt=""] se a imagem for apenas decorativa';
					_diagnostics(m, message, 1);
				}
				break;
			case (/<inpu/i.test(el)):
				if ((/type="image"/i.test(m[0])) && (!/alt="(?:.*?[a-z].*?)"/i.test(m[0])) && (!/alt=""/i.test(m[0]))) {
					problems++;
					let message = 'Insira um texto que descreva a imagem, ou [alt=""] se a imagem for apenas decorativa';
					_diagnostics(m, message, 1);
				}
				break;

			//3.1 * Idioma principal da página
			case (/<html/i.test(el)):
				if ((!/lang="(?:.*?[a-z].*?)"/i.test(m[0])) || (/lang=""/i.test(m[0])) || (!/lang/i.test(m[0])) || (/""/i.test(m[0]))){
					problems++;
					let message = 'Você deve indicar qual o idioma principal da página, [lang="pt-br"]';
					_diagnostics(m, message, 1);
				}
				break;

			//5.1-5.3 * Alternativa para video/audio
			case (/<vide/i.test(el)):
				if (true){
					problems++;
					let message = 'Caso o vídeo não possua legenda, disponibilize um arquivo de texto com o conteúdo do vídeo';
					_diagnostics(m, message, 2);
					let message2 = 'Caso o vídeo transmita algo que não esteja disponível na faixa de áudio, o vídeo deve possuir uma audiodescrição';
					_diagnostics(m, message2, 2);
				}
				break;
			case (/<audi/i.test(el)):
				if (true){
					problems++;
					let message = 'Forneça um arquivo de texto referente ao áudio disponibilizado';
					_diagnostics(m, message, 2);
				}
				break;
			
			case (/<ifra/i.test(el)):
				if (true){
					problems++;
					let messageV = 'Em caso de vídeo, e não possua legenda, disponibilize um arquivo de texto com o conteúdo do vídeo';
					_diagnostics(m, messageV, 2);
					let messageV2 = 'Em caso de vídeo e ele transmitir algo que não esteja disponível na faixa de áudio, o vídeo deve possuir uma audiodescrição';
					_diagnostics(m, messageV2, 2);
					let messageA = 'Em caso de áudio, forneça um arquivo de texto referente ao áudio disponibilizado';
					_diagnostics(m, messageA, 2);
				}
				break;

			// 3.5 * Descrição clara do link
			case (/<a/i.test(el)):
				let filteredString = m[0].replace(/<a (?:\s|\S)+?>/ig, "");
				filteredString = filteredString.replace(/<\/a>/,"");
				for (let description of listBadDescritivesA){
					if (description === filteredString.toLowerCase()){
						problems++;
						let message = 'Descreva o link de forma clara e sucinta dentro da tag';
						_diagnostics(m, message, 1);
						break;
					}
				}
				break;

			//6.1 e 6.4 * Formulários
			case(/<form/i.test(el)):
				if(/<select (?:.+?)?onchange=(?:.+?)?/i.test(m[0])){
					problems++;
					let message = "Não deve haver uma mudança automática, as mudanças devem acontecer através de um botão";
					_diagnostics(m, message, 4);
				}
				if ((/<inpu(?:.+?)?type="reset"(?:.+?)?/i.test(m[0])) && (!	/<inpu(?:.+?)?value="(?:.+?)?"/i.test(m[0]))){
					problems++;
					let message = 'Forneça uma alternativa de texto para os botões type="reset" [value="Reset/Limpar"]';
					_diagnostics(m, message, 4);
				}
				break;
				
			//2.3, 2.4, 3.3 * verificando atualização automática da página e título
			case (/<head/i.test(el)):
				if (!/<title>/i.test(m[0])) {
					problems++;
					let message = 'Insira a tag [<title>] no cabeçalho';
					_diagnostics(m, message, 1);
				}
				if (/<meta (?:.+?)?http-equiv="refresh"(?:.+?)?>/i.test(m[0])){
						problems++;
						let message = 'A atualização automatica da página só deverá ser feita, se for realmente necessária e o usuário deverá ser notificado [tag <meta>]';
						_diagnostics(m, message, 2);
						
				}
				if ((!/<title>(?:[\s\S]*?[a-z][\s\S]*?)<\/title>/i.test(m[0])) && (/<title>/i.test(m[0]))) {
					problems++;
					let message = 'Insira um título a página';
					_diagnostics(m, message, 1);
				}
				break;
		}
	}
	async function _diagnostics(regEx: RegExpExecArray, diagnosticsMessage: string, severityNumber: number) {
		let severity: DiagnosticSeverity;

		switch(severityNumber){
			case(1):
				severity= DiagnosticSeverity.Error;
			break;
			case(2):
				severity= DiagnosticSeverity.Hint;
			break;
			case(3):
				severity= DiagnosticSeverity.Information;
			break;
			case(4):
				severity= DiagnosticSeverity.Warning;
			break;
			default:
				severity= DiagnosticSeverity.Error;
			break;

		}
		let diagnostic: Diagnostic = {
			severity,
			message: diagnosticsMessage,
			range: {
				start: textDocument.positionAt(regEx.index),
				end: textDocument.positionAt(regEx.index + regEx[0].length),
			},
			code: 7,
			source: 'nowill'
		};
		diagnostics.push(diagnostic);
	}
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });	
}

connection.onDidChangeWatchedFiles(_change => {
	connection.console.log('We received an file change event');
});


documents.listen(connection);

connection.listen();
