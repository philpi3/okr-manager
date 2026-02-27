import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		files: ['src/**/*.ts'],
		plugins: {
			obsidianmd,
			'@typescript-eslint': tseslint,
		},
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		rules: {
			// Obsidian-specific rules (from plugin recommended config)
			...obsidianmd.configs.recommended,

			// Override sentence-case to recognise OKR acronyms and skip e.g./digit-prefixed strings
			'obsidianmd/ui/sentence-case': ['error', {
				enforceCamelCaseLower: true,
				acronyms: ['OKR', 'KR', 'MRR', 'API', 'HTTP', 'HTTPS', 'URL', 'DNS', 'TCP', 'IP',
					'SSH', 'TLS', 'SSL', 'FTP', 'SFTP', 'SMTP', 'JSON', 'XML', 'HTML', 'CSS',
					'PDF', 'CSV', 'YAML', 'SQL', 'PNG', 'JPG', 'JPEG', 'GIF', 'SVG', '2FA',
					'MFA', 'OAuth', 'JWT', 'LDAP', 'SAML', 'SDK', 'IDE', 'CLI', 'GUI', 'CRUD',
					'REST', 'SOAP', 'CPU', 'GPU', 'RAM', 'SSD', 'USB', 'UI', 'OK', 'RSS', 'S3',
					'WebDAV', 'ID', 'UUID', 'GUID', 'SHA', 'MD5', 'ASCII', 'UTF-8', 'UTF-16',
					'DOM', 'CDN', 'FAQ', 'AI', 'ML'],
				brands: ['OKRs', 'KRs', 'iOS', 'iPadOS', 'macOS', 'Windows', 'Android', 'Linux',
					'Obsidian', 'Obsidian Sync', 'Obsidian Publish', 'Google Drive', 'Dropbox',
					'OneDrive', 'iCloud Drive', 'YouTube', 'Slack', 'Discord', 'Telegram',
					'WhatsApp', 'Twitter', 'X', 'Readwise', 'Zotero', 'Excalidraw', 'Mermaid',
					'Markdown', 'LaTeX', 'JavaScript', 'TypeScript', 'Node.js', 'npm', 'pnpm',
					'Yarn', 'Git', 'GitHub', 'GitLab', 'Notion', 'Evernote', 'Roam Research',
					'Logseq', 'Anki', 'Reddit', 'VS Code', 'Visual Studio Code', 'IntelliJ IDEA',
					'WebStorm', 'PyCharm'],
				ignoreRegex: ['^[Ee]\\.g\\.', '^\\d'],
			}],

			// TypeScript promise rules (checked by the review bot)
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-expressions': 'error',
			'@typescript-eslint/require-await': 'error',
		},
	},
];
