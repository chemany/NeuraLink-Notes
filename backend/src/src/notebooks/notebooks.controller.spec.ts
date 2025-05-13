import { Test, TestingModule } from '@nestjs/testing';
import { NotebooksController } from './notebooks.controller';

describe('NotebooksController', () => {
  let controller: NotebooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotebooksController],
    }).compile();

    controller = module.get<NotebooksController>(NotebooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
