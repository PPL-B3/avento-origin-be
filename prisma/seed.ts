import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.message.createMany({
    data: [
      { content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      {
        content: "Integer pretium lobortis enim, at accumsan sem egestas vel.",
      },
      {
        content:
          "Integer sed posuere ante. Praesent nunc dui, ultrices et mi at, pellentesque vehicula enim.",
      },
    ],
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
