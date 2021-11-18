import { Message } from 'discord.js';
import _ from 'lodash';
import { AbstractModule, Commands, Module, NextFunction } from 'negan-bot';

@Module({
    name: 'counter',
    alwaysActivated: false
})
export class CounterModule extends AbstractModule {

    static readonly COUNTER_LABEL: string = 'counter';
    static readonly COUNTER_CHANNEL_LABEL: string = 'counter-channel';
    static readonly COUNTER_LAST_AUTHOR_ID_LABEL: string = 'last-author-id';
    private currentCount: Map<string, number> = new Map();
    private lastAuthorID: Map<string, string> = new Map();
    private channelID: Map<string, string> = new Map();

    handle(msg: Message, next: NextFunction): void {
        // DM
        if (!msg.guildId) {
            next();
            return;
        }

        // Wrong channel
        if (msg.channel.id !== this.channelID.get(msg.guildId)) {
            next();
            return;
        }

        if (!this.currentCount.has(msg.guildId)) {
            this.currentCount.set(msg.guildId, 0);
        }

        const correctNewValue: number = (this.currentCount.get(msg.guildId) as number) + 1;
        const sameUser: boolean = msg.author.id === this.lastAuthorID.get(msg.guildId);

        if (msg.content !== `${correctNewValue}` || sameUser) {
            console.log(`${msg.content} war falsch, lösche`)
            try {
                msg.delete();
            }
            catch (e: any) {
                console.log(e);
            }
        }
        else {
            this.currentCount.set(msg.guildId, correctNewValue);
            this.lastAuthorID.set(msg.guildId, msg.author.id);
            this.save(msg.guildId);
        }


        next();
    }

    private save(guildID: string): void {
        this.database.update(guildID, CounterModule.COUNTER_LABEL, this.currentCount.get(guildID));
        this.database.update(guildID, CounterModule.COUNTER_LAST_AUTHOR_ID_LABEL, this.lastAuthorID.get(guildID));
    }

    async init(): Promise<void> {
        Array.from((await this.getAllGuilds())
            .keys())
            .forEach((guildID: string) => {
                this.load(guildID);
            });
    }

    protected registerCommands(): Commands | undefined {
        return {
            'set-counter': {
                onlyMods: true,
                handler: async (msg: Message) => this.setCounter(msg)
            },
            'set-counter-channel': {
                onlyMods: true,
                handler: async (msg: Message) => this.setCounterChannel(msg)
            }
        };
    }

    private load(guildID: string): void {
        this.database.read<string>(guildID, CounterModule.COUNTER_CHANNEL_LABEL)
            .then((channelID: string | undefined) => {
                if (channelID) {
                    this.channelID.set(guildID, `${channelID}`);
                }
            });

        this.database.read<string>(guildID, CounterModule.COUNTER_LAST_AUTHOR_ID_LABEL)
            .then((lastAuthorID: string | undefined) => {
                if (lastAuthorID) {
                    this.lastAuthorID.set(guildID, lastAuthorID);
                }
            });

        this.database.read<string>(guildID, CounterModule.COUNTER_LABEL)
            .then((currentCounter: string | undefined) => {
                if (currentCounter) {
                    const cN: number = Number.parseInt(currentCounter);
                    this.currentCount.set(guildID, cN);
                }
                else {
                    this.database.create(guildID, CounterModule.COUNTER_LABEL, 0);
                    this.currentCount.set(guildID, 0);
                }
            });
    }


    private setCounter(msg: Message): void {

        if (!msg.guildId) return;

        const param: string = msg.content.split(" ")[1];
        const parsed: number = Number.parseInt(param);
        if (Number.isNaN(parsed)) {
            return;
        }
        this.currentCount.set(msg.guildId, parsed);
        this.save(msg.guildId);

        msg.reply(`Alles klar, habe den Counter auf ${this.currentCount.get(msg.guildId)} gesetzt`);
    }

    private setCounterChannel(msg: Message): void {

        if (!msg.guildId) return;

        const param: string = msg.content.split(" ")[1];
        const regex: RegExp = new RegExp(/<#(\d+)>/gm);

        if (!regex.test(param)) {
            msg.reply('Invalider Wert');
            return;
        }

        const parsed: string = param.replace('<', '').replace('>', '').replace('#', '');

        if (!msg.guild?.channels.cache.has(parsed)) {
            msg.reply('Unbekannter Channel');
            return;
        }

        msg.reply(`Ok, ich setze ${param} als Channel für's Zählen`);

        this.channelID.set(msg.guildId, parsed);
        this.saveCounterChannel(msg.guildId);
    }
    private saveCounterChannel(guildID: string): void {

        const key: string = CounterModule.COUNTER_CHANNEL_LABEL;
        const newChannelID: string = this.channelID.get(guildID) as string;

        this.database.read<string>(guildID, key)
            .then((channelID: string | undefined) => {
                if (channelID) {
                    this.database.update(guildID, key, newChannelID);
                }
                else {
                    this.database.create(guildID, key, newChannelID);
                }
            });
    }
}
