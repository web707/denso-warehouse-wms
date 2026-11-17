import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FILE_LIMIT } from './document-files';
import { DocumentsService } from './documents.service';

const writers = [UserRole.ADMIN,UserRole.WAREHOUSE_MANAGER,UserRole.WAREHOUSE_STAFF] as const;
const positive = (v:string|undefined) => {
  const result=Number(v);
  if (!/^[1-9]\d{0,5}$/.test(v??'') || !Number.isSafeInteger(result)) throw new BadRequestException('Số trang hoặc phiên bản không hợp lệ');
  return result;
};
const options=(input:any) => ({landscape:input?.landscape===true||input?.landscape==='true',qr:input?.qr===true||input?.qr==='true'});

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service:DocumentsService) {}

  @Get()
  list(@CurrentUser() user:AuthenticatedUser,@Query('q') q='',@Query('kind') kind='',@Query('status') status='',
    @Query('day') day='',@Query('creator') creator='') {
    return this.service.list(user,q.slice(0,180),kind,status,day,creator);
  }

  @Post()
  @Roles(...writers)
  create(@CurrentUser() user:AuthenticatedUser,@Body('kind') kind:string) { return this.service.create(kind,user); }

  @Post('upload')
  @Roles(...writers)
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:FILE_LIMIT,files:1,fields:1,parts:2}}))
  upload(@CurrentUser() user:AuthenticatedUser,@Body('kind') kind:string,@UploadedFile() file?:Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Cần chọn tệp chứng từ');
    return this.service.create(kind,user,file.buffer,file.originalname);
  }

  @Post('source/:kind/:reference')
  @Roles(...writers)
  fromReference(@Param('kind') kind:string,@Param('reference',ParseUUIDPipe) reference:string,@CurrentUser() user:AuthenticatedUser) {
    return this.service.fromReference(kind,reference,user);
  }

  @Get('lookup/:id')
  lookup(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser) { return this.service.detail(id,user); }

  @Get(':id')
  detail(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser) { return this.service.detail(id,user); }

  @Get(':id/extraction')
  async extraction(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser) {
    const doc=await this.service.detail(id,user);
    return {pages:doc.extraction??[],fields:doc.fields};
  }

  @Post(':id/scan')
  @Roles(...writers)
  scan(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser) { return this.service.scan(id,user); }

  @Patch(':id/draft')
  @Roles(...writers)
  save(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Body() input:unknown) {
    return this.service.review(id,user,input,'save');
  }

  @Post(':id/validate')
  @Roles(...writers)
  validate(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Body() input:unknown) {
    return this.service.review(id,user,input,'validate');
  }

  @Post(':id/confirm')
  @Roles(...writers)
  confirm(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Body() input:unknown) {
    return this.service.review(id,user,input,'confirm');
  }

  @Get(':id/file')
  async file(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,
    @Res({passthrough:true}) response:Response,@Query('page') page?:string) {
    const result=await this.service.file(id,user,page===undefined?undefined:positive(page));
    response.setHeader('Cache-Control','private, no-store');
    const suffix=result.mime.includes('spreadsheet')?'xlsx':result.mime.split('/')[1];
    return new StreamableFile(result.bytes,{type:result.mime,disposition:page?'inline':`attachment; filename="${id}.${suffix}"`});
  }

  @Get(':id/preview')
  async preview(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Query() query:unknown,
    @Res({passthrough:true}) response:Response) {
    response.setHeader('Cache-Control','private, no-store');
    return new StreamableFile(await this.service.preview(id,user,options(query)),{type:'application/pdf',disposition:'inline'});
  }

  @Post(':id/issue')
  @Roles(UserRole.ADMIN,UserRole.WAREHOUSE_MANAGER)
  issue(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Body() input:unknown) {
    return this.service.issue(id,user,options(input));
  }

  @Get(':id/pdf')
  async pdf(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Query('version') version:string,
    @Res({passthrough:true}) response:Response) {
    response.setHeader('Cache-Control','private, no-store');
    return new StreamableFile(await this.service.issued(id,positive(version),user),{type:'application/pdf',disposition:'inline'});
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN,UserRole.WAREHOUSE_MANAGER)
  void(@Param('id',ParseUUIDPipe) id:string,@CurrentUser() user:AuthenticatedUser,@Body('reason') reason:string) {
    return this.service.void(id,user,reason);
  }
}
