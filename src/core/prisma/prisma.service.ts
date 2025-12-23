import { PrismaClient } from "@prisma/client";

export class PrismaService extends PrismaClient {
  private _userBlock: any;
  public get userBlock(): any {
    return this._userBlock;
  }
  public set userBlock(value: any) {
    this._userBlock = value;
  }
}
