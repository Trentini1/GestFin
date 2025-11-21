CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cnpj` varchar(18),
	`email` varchar(320),
	`telefone` varchar(20),
	`endereco` text,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`userId` int NOT NULL,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firebaseConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKey` varchar(255) NOT NULL,
	`authDomain` varchar(255) NOT NULL,
	`projectId` varchar(255) NOT NULL,
	`storageBucket` varchar(255) NOT NULL,
	`messagingSenderId` varchar(255) NOT NULL,
	`appId` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firebaseConfig_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lancamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataEmissao` timestamp NOT NULL,
	`cliente` varchar(255) NOT NULL,
	`clienteId` int,
	`numeroNf` varchar(100),
	`os` varchar(100),
	`descricao` text,
	`valorTotal` int NOT NULL,
	`taxaComissao` int NOT NULL DEFAULT 50,
	`comissao` int NOT NULL DEFAULT 0,
	`faturado` boolean NOT NULL DEFAULT false,
	`dataFaturamento` timestamp,
	`observacoes` text,
	`pagamentos` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`userId` int NOT NULL,
	CONSTRAINT `lancamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notasCompra` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataEmissao` timestamp NOT NULL,
	`fornecedor` varchar(255) NOT NULL,
	`numeroNf` varchar(100),
	`osId` varchar(100),
	`valorTotal` int NOT NULL,
	`descricao` text,
	`observacoes` text,
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`userId` int NOT NULL,
	CONSTRAINT `notasCompra_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `variaveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` timestamp NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`valor` int NOT NULL,
	`tipo` enum('credito','debito') NOT NULL DEFAULT 'credito',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`userId` int NOT NULL,
	CONSTRAINT `variaveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `gestfinRole` enum('admin','padrao','leitura') DEFAULT 'padrao' NOT NULL;