import { Test, TestingModule } from '@nestjs/testing';
import { HelloController } from './hello.controller';
import { HelloService } from './hello.service';

describe('HelloController', () => {
  let controller: HelloController;
  let helloService: HelloService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelloController],
      providers: [
        {
          provide: HelloService,
          useValue: {
            getHello: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HelloController>(HelloController);
    helloService = module.get<HelloService>(HelloService);
  });

  it('should return messages from HelloService', async () => {
    const expected = { messages: ['Hello from controller'] };
    (helloService.getHello as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getHello();
    expect(result).toEqual(expected);

    expect(helloService.getHello).toHaveBeenCalled();
  });
});
