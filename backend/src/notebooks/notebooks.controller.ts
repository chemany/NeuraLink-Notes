import {
  Controller,
  Get,
  Post,
  Body,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { NotebooksService } from './notebooks.service'; // 导入服务
import { Notebook } from '@prisma/client'; // 导入类型
import { CreateNotebookDto } from './dto/create-notebook.dto'; // 导入 DTO
import { UpdateNotebookDto } from './dto/update-notebook.dto'; // 导入更新 DTO

@Controller('notebooks') // 定义基础路由为 /notebooks
export class NotebooksController {
  // 注入 NotebooksService
  constructor(private readonly notebooksService: NotebooksService) {}

  @Get() // 处理 GET /notebooks 请求
  @HttpCode(HttpStatus.OK) // 设置成功响应状态码为 200
  async findAll(): Promise<Notebook[]> {
    console.log('[NotebooksController] Received request for GET /notebooks');
    // 调用服务获取数据
    return this.notebooksService.findAll();
  }

  @Post() // 处理 POST /notebooks 请求
  @HttpCode(HttpStatus.CREATED) // 设置成功创建状态码为 201
  async create(
    // 使用 @Body 装饰器获取请求体
    // 使用 ValidationPipe 自动验证 DTO
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createNotebookDto: CreateNotebookDto,
  ): Promise<Notebook> {
    console.log(
      '[NotebooksController] Received request for POST /notebooks, body:',
      createNotebookDto,
    );
    // 调用服务创建笔记本
    return this.notebooksService.create(createNotebookDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Notebook | null> {
    return this.notebooksService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.notebooksService.remove(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateNotebookDto: UpdateNotebookDto,
  ): Promise<Notebook> {
    console.log(
      `[NotebooksController] Updating notebook ${id} with data:`,
      updateNotebookDto,
    );
    return this.notebooksService.update(id, updateNotebookDto);
  }

  // 未来可以添加其他路由处理方法
  // @Post()
  // create(...) { ... }
  // @Get(':id')
  // findOne(...) { ... }
  // @Patch(':id')
  // update(...) { ... }
  // @Delete(':id')
  // remove(...) { ... }
}
