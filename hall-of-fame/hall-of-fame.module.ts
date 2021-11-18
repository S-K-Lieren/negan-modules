import { Guild, Message, TextBasedChannels, MessageReaction, PartialMessageReaction, GuildChannel, ThreadChannel } from 'discord.js';
import _ from 'lodash';
import { AbstractModule, Commands, DiscordID, EmbedInfo, GuildID, Module, NextFunction, Util } from 'negan-bot';

type MessageTuple = [DiscordID, DiscordID];

@Module({
    name: 'hall-of-fame',
    alwaysActivated: false
})
export class HallOfFameModule extends AbstractModule {

    private hallOfFameMessages: Map<GuildID, Array<MessageTuple>> = new Map();
    private hallOfFameChannels: Map<GuildID, DiscordID> = new Map();
    private readonly HALL_OF_FAME_MESSAGES_DB_KEY: string = 'hall-of-fame-message-ids';
    private readonly CHANNEL_ID_DB_KEY: string = 'hall-of-fame-message-channel-id';
    private readonly LIKE_EMOJI: string = '⭐';
    private readonly THRESHOLD: number = 1;

    protected async handleReaction(reaction: MessageReaction | PartialMessageReaction, next: NextFunction): Promise<void> {
        if (reaction.emoji.name === this.LIKE_EMOJI) {
            // do something
            const msg: Message<boolean> = await reaction.message.fetch(true);
            const likeReaction: Array<MessageReaction> = Array.from(msg.reactions.cache.entries())
                .filter(([key, _value]: [string, MessageReaction]) => key === this.LIKE_EMOJI)
                .map(([_key, value]: [string, MessageReaction]) => value);

            if (!likeReaction.length) return;

            const count: number = likeReaction[0].count;

            if (count >= this.THRESHOLD) {
                this.postMessageInHallOfFame(msg, count);
            }
        }
        next();
    }

    protected async init(): Promise<void> {
        const allGuilds: Map<string, Guild> = await this.getAllGuilds();
        allGuilds.forEach((guild: Guild) => this.load(guild.id));
    }

    protected registerCommands(): Commands | undefined {
        return {
            'set-hall-of-fame-channel': {
                onlyMods: true,
                handler: (msg: Message) => this.setHallOfFameChannel(msg)
            }
        }
    }
    private setHallOfFameChannel(msg: Message<boolean>): void {
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

        msg.reply(`Ok, ich setze ${param} als neuen Hall Of Fame-Channel :)`);

        this.hallOfFameChannels.set(msg.guildId, parsed);
        this.saveHallOfFameChannel(msg.guildId);
    }


    private async postMessageInHallOfFame(msg: Message, newCount: number): Promise<void> {
        if (!msg.guildId) return;

        if (!this.hallOfFameChannels.has(msg.guildId)) {
            return;
        }

        // There are highlighted messages in this discord
        if (this.hallOfFameMessages.has(msg.guildId)) {

            const msgTuple: MessageTuple | undefined = _.find(this.hallOfFameMessages.get(msg.guildId), (tuple: MessageTuple) => tuple[0] === msg.id);
            if (msgTuple) {
                const [_originalMsgID, embedMsgID] = msgTuple;

                const guild: Guild | undefined = this.client.guilds.cache.get(msg.guildId);
                if (!guild) return;

                const channel: GuildChannel | ThreadChannel | undefined = guild.channels.cache.get(this.hallOfFameChannels.get(msg.guildId) as string);
                if (!channel) return;

                const c: TextBasedChannels = await channel.fetch() as TextBasedChannels;

                c.messages.fetch(embedMsgID)
                    .then((embedMessage: Message) => {
                        // Edit the message
                        embedMessage.edit(`:dizzy: ${newCount}`);
                    })
                    .catch(() => {
                        const filteredResult: Array<MessageTuple> = _.filter(
                            (this.hallOfFameMessages.get(msg.guildId as string) as Array<MessageTuple>),
                            (tuple: MessageTuple) => tuple[1] === embedMsgID
                        );

                            this.hallOfFameMessages.set(msg.guildId as string, filteredResult);
                            this.saveHallOfFameMessages(msg.guildId as string);
                    });
                return;
            }
        }

        // Create new Embed message
        const embed: EmbedInfo = {
            thumbnail: '',
            url: '',
            img: '',
            author: {
                iconURL: msg.author.avatarURL() as string,
                name: msg.author.username
            }
        };

        const content: string = `${msg.content}\n\n[Zur Nachricht](${msg.url})\n<t:${Math.floor(msg.createdTimestamp / 1000)}:R>`;

        const embedMessageID: DiscordID | undefined = await Util.sendEmbedMessage(
            this.hallOfFameChannels.get(msg.guildId) as string,
            content,
            {
                info: embed
            },
            this.client
        );

        if (embedMessageID) {

            const hallOfFameMessageIDs: Array<MessageTuple> = this.hallOfFameMessages.get(msg.guildId) || [];
            hallOfFameMessageIDs.push([msg.id, embedMessageID]);
            this.hallOfFameMessages.set(msg.guildId, hallOfFameMessageIDs);

            this.saveHallOfFameMessages(msg.guildId);
        }

    }

    private async load(guildID: string): Promise<void> {
        // Highlighted messages
        const loadedValues: string | undefined = await this.database.read(guildID, this.HALL_OF_FAME_MESSAGES_DB_KEY);

        if (loadedValues) {
            this.hallOfFameMessages.set(guildID, JSON.parse(loadedValues));
        }
        else {
            this.hallOfFameMessages.set(guildID, []);
        }

        // Message highlighting channel
        const loadedChannelID: string | undefined = await this.database.read(guildID, this.CHANNEL_ID_DB_KEY);

        if (loadedChannelID) {
            this.hallOfFameChannels.set(guildID, loadedChannelID);
        }
    }

    private saveHallOfFameChannel(guildID: GuildID): void {
        this.database.update(guildID, this.CHANNEL_ID_DB_KEY, this.hallOfFameChannels.get(guildID));
    }

    private saveHallOfFameMessages(guildID: GuildID): void {
        this.database.update(guildID, this.HALL_OF_FAME_MESSAGES_DB_KEY, JSON.stringify(this.hallOfFameMessages.get(guildID)));
    }
}
