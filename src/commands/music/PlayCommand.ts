import { ApplyOptions } from "@sapphire/decorators";
import { ApplicationCommandRegistry, Args, Command, RegisterBehavior } from "@sapphire/framework";
import { CommandInteraction, Message, TextChannel, VoiceChannel } from "discord.js";
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { devGuilds } from "../../config";
import { CommandContext } from "../../structures/CommandContext";
import { ShoukakuHandler } from "../../structures/ShoukakuHandler";
import { Util } from "../../utils/Util";

@ApplyOptions<Command.Options>({
    aliases: [],
    name: "play",
    description: "Add a music to the queue",
    preconditions: ["isNodeAvailable", "memberInVoice", "memberVoiceJoinable", "memberInSameVoice"],
    chatInputCommand: {
        register: true,
        guildIds: devGuilds,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
    }
})
export class PlayCommand extends Command {
    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand({
            name: this.name,
            description: this.description,
            options: [
                {
                    name: "query",
                    type: ApplicationCommandOptionTypes.STRING,
                    description: "Music to play (the title or supported link)",
                    required: true
                }
            ]
        });
    }

    public async chatInputRun(interaction: CommandInteraction<"cached">): Promise<any> {
        await interaction.deferReply();
        return this.run(new CommandContext(interaction));
    }

    public messageRun(message: Message, args: Args): Promise<any> {
        return this.run(new CommandContext(message, args));
    }

    public async run(ctx: CommandContext): Promise<any> {
        const argsQuery = await ctx.args?.restResult("string");
        if (!argsQuery?.success && !ctx.options) {
            return ctx.send({
                embeds: [
                    Util.createEmbed("error", "Please provide a valid query", true)
                ]
            });
        }
        const query = argsQuery?.value ?? ctx.options?.getString("query", true);
        const result = await this.container.client.shoukaku.getNode().rest.resolve(query!, ShoukakuHandler.getProvider(query!));
        if (result.type === "NO_MATCHES" || !result.tracks.length) {
            return ctx.send({
                content: "Couldn't obtain any result matching the query"
            });
        }
        const dispatcher = this.container.client.shoukaku.getDispatcher({
            guild: ctx.context.guild!,
            member: ctx.context.member!,
            textChannel: ctx.context.channel as TextChannel,
            voiceChannel: ctx.context.member!.voice.channel as VoiceChannel
        });
        if (!dispatcher.player) {
            const response = await dispatcher.connect();
            if (response.error) {
                return ctx.send({
                    content: `Failed when trying to join your channel: \`${response.error}\``
                });
            }
        }
        dispatcher.addTracks([
            {
                track: result.tracks[0],
                requester: ctx.author.id
            }
        ]);
        if (!dispatcher.player?.track) {
            dispatcher.player?.playTrack(dispatcher.queue[0]);
        }
        return ctx.send({
            content: `Added \`${result.tracks[0].info.title!}\` to the queue`
        });
    }
}
