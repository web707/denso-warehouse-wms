import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentFiles } from './document-files';

@Module({ controllers: [DocumentsController], providers: [DocumentsService, DocumentFiles] })
export class DocumentsModule {}
