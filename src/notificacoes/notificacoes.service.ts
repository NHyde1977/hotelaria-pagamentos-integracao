import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificacoesService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    @Inject('RABBITMQ_NOTIFICACOES')
    private readonly rabbitClient: ClientProxy,

    @Inject('RABBITMQ_RESERVAS')
    private readonly reservasClient: ClientProxy,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitClient.connect();
    this.logger.log('Conectado ao RabbitMQ - Notificacoes!');

    await this.reservasClient.connect();
    this.logger.log('Conectado ao RabbitMQ - Reservas!');
  }

  async onModuleDestroy(): Promise<void> {
    await this.rabbitClient.close();
    await this.reservasClient.close();
  }

  async publicarEvento(
    evento: string,
    dados: Record<string, unknown>,
  ): Promise<void> {
    const mensagem = {
      evento,
      dados,
      data_hora: new Date().toISOString(),
    };

    try {
      if (evento === 'pagamento.aprovado') {
        await firstValueFrom(
          this.reservasClient.emit(evento, mensagem),
        );

        this.logger.log(
          `Evento publicado para Reservas: ${evento}`,
        );
      }

      await firstValueFrom(
        this.rabbitClient.emit(evento, mensagem),
      );

      this.logger.log(
        `Evento publicado para Notificacoes: ${evento}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao publicar evento: ${evento}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}