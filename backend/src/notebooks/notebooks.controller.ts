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
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotebooksService } from './notebooks.service'; // 导入服务
import { Notebook } from '@prisma/client'; // 导入类型
import { CreateNotebookDto } from './dto/create-notebook.dto'; // 导入 DTO
import { UpdateNotebookDto } from './dto/update-notebook.dto'; // 导入更新 DTO
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // 导入 JwtAuthGuard
import { User as UserModel } from '@prisma/client'; // Prisma User 模型

interface AuthenticatedRequest extends Request {
  user: Omit<UserModel, 'password'> & { id: string };
}

@Controller('notebooks') // 定义基础路由为 /notebooks
@UseGuards(JwtAuthGuard) // 应用 JwtAuthGuard 到整个控制器
export class NotebooksController {
  // 注入 NotebooksService
  constructor(private readonly notebooksService: NotebooksService) {}

  @Get() // 处理 GET /notebooks 请求
  @HttpCode(HttpStatus.OK) // 设置成功响应状态码为 200
  async findAll(@Request() req: AuthenticatedRequest): Promise<Notebook[]> {
    const userId = req.user.id;
    console.log('[NotebooksController] Received request for GET /notebooks');
    // 调用服务获取数据
    return this.notebooksService.findAll(userId);
  }

  @Post() // 处理 POST /notebooks 请求
  @HttpCode(HttpStatus.CREATED) // 设置成功创建状态码为 201
  async create(
    // 使用 @Body 装饰器获取请求体
    // 使用 ValidationPipe 自动验证 DTO
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createNotebookDto: CreateNotebookDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Notebook> {
    const userId = req.user.id;
    console.log(
      '[NotebooksController] Received request for POST /notebooks, body:',
      createNotebookDto,
    );
    // 调用服务创建笔记本
    return this.notebooksService.create(createNotebookDto, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Notebook | null> {
    const userId = req.user.id;
    return this.notebooksService.findOne(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Notebook> {
    const userId = req.user.id;
    return this.notebooksService.remove(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateNotebookDto: UpdateNotebookDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Notebook> {
    const userId = req.user.id;
    console.log(
      `[NotebooksController] Updating notebook ${id} with data:`,
      updateNotebookDto,
    );
    return this.notebooksService.update(id, userId, updateNotebookDto, undefined);
  }

  // 端点：获取特定笔记本的 notes.json 内容
  @Get(':id/notesfile')
  @HttpCode(HttpStatus.OK)
  async getNotebookNotesFile(
    @Param('id') notebookId: string,
    @Request() req: AuthenticatedRequest
  ): Promise<{ notes: string | null }> {
    const userId = req.user.id;
    return { notes: await this.notebooksService.getNotebookNotesFromFile(notebookId, userId) };
  }

  // 端点：更新特定笔记本的 notes.json 内容
  @Post(':id/notesfile')
  @HttpCode(HttpStatus.OK)
  async updateNotebookNotesFile(
    @Param('id') notebookId: string,
    @Body('notesContent') notesContent: string,
    @Request() req: AuthenticatedRequest
  ): Promise<Notebook> {
    const userId = req.user.id;
    const emptyUpdateDto: UpdateNotebookDto = {};
    return this.notebooksService.update(notebookId, userId, emptyUpdateDto, notesContent);
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
