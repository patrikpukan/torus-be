import { Controller, Get } from '@nestjs/common';
import { QuacksService } from '../services/quacks.service';
import { QuackType } from '../graphql/types/quack.type';

@Controller('quacks')
export class QuackController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  async getQuacks(): Promise<QuackType[]> {
    return this.quacksService.getQuacks();
  }

  @Get('count')
  async getQuacksCount(): Promise<{ count: number }> {
    const quacks = await this.quacksService.getQuacks();
    return { count: quacks.length };
  }
}
