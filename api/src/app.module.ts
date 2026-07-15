import { Module } from '@nestjs/common';
import { ProtectionController } from './protection/protection.controller';
import { Permit2Controller } from './permit2/permit2.controller';
import { OnchainService } from './onchain/onchain.service';

@Module({
  controllers: [ProtectionController, Permit2Controller],
  providers: [OnchainService],
})
export class AppModule {}
