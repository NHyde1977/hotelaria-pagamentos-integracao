import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ClientsModule,
  Transport,
} from '@nestjs/microservices';
import { NotificacoesService } from './notificacoes.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_NOTIFICACOES',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.getOrThrow<string>('RABBITMQ_URL'),
            ],
            queue: 'notificacoes_pagamentos',
            persistent: true,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
      {
        name: 'RABBITMQ_RESERVAS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.getOrThrow<string>('RABBITMQ_URL'),
            ],
            queue: 'reservas_pagamentos',
            persistent: true,
            queueOptions: {
              durable: true,
              deadLetterExchange: '',
              deadLetterRoutingKey: 'reservas_pagamentos_dlq',
            },
          },
        }),
      },
    ]),
  ],
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}