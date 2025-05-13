import { Test, TestingModule } from '@nestjs/testing';
import { NotebooksService } from './notebooks.service';

describe('NotebooksService', () => {
  let service: NotebooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotebooksService],
    }).compile();

    service = module.get<NotebooksService>(NotebooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
