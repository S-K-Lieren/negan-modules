# Hall of fame

This is a simple hall of fame module for [negan-bot](https://www.npmjs.com/package/negan-bot).

"Hall of fame". Users can "like" messages by reacting with :star:. If at least 7 users like a message, it will be reposted into a channel specified by server owner or mod.

## Configuration

The threshold can be configured.

Example:

```typescript
import { NeganBot } from 'negan-bot';
import { HallOfFameModule } from 'negan-module-hall-of-fame';

const bot: NeganBot = new NeganBot();


bot.registerModules([
    HallOfFameModule
]);

const hofModule: HallOfFameModule | undefined = bot.getModule(HallOfFameModule);
if (hofModule) {
    hofModule.setThreshold(2);
}

```