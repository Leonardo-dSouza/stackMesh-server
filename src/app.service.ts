import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'StackMesh API v1.0.0 - running';
  }
}
