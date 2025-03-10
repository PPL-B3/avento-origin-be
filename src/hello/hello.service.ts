import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HelloService {
  constructor(private readonly prismaService: PrismaService) {}

  async getHello(): Promise<{ messages: string[] }> {
    const msgs_obj = await this.prismaService.message.findMany({
      select: { content: true },
    });
    const msgs = msgs_obj.map((obj) => obj.content);
    if (msgs) {
      return { messages: msgs };
    }
    return { messages: ["No messages available"] };
  }
}
