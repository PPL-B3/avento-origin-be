import { User } from "@prisma/client";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  createUser(data: {
    email: string;
    password: string;
    lastLogout: bigint;
  }): Promise<User>;
  markLogout(id: string, timestamp: bigint): Promise<void>;
}
