import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { SystemTypeGuard } from "../users/system-type.guard";
import { TradeFlowBooksService } from "./tradeflow-books.service";
import { TradeFlowController } from "./tradeflow.controller";
import { TradeFlowService } from "./tradeflow.service";

@Module({
  controllers: [TradeFlowController],
  providers: [TradeFlowService, TradeFlowBooksService, PermissionsGuard, SystemTypeGuard],
  exports: [TradeFlowService, TradeFlowBooksService],
})
export class TradeFlowModule {}
