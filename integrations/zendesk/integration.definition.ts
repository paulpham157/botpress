/* bplint-disable */
import * as sdk from '@botpress/sdk'
import { sentry as sentryHelpers } from '@botpress/sdk-addons'
import hitl from './bp_modules/hitl'
import { actions, events, configuration, channels, states, user } from './src/definitions'

export default new sdk.IntegrationDefinition({
  name: 'zendesk',
  title: 'Zendesk',
  version: '2.7.0',
  icon: 'icon.svg',
  description:
    'Optimize your support workflow. Trigger workflows from ticket updates as well as manage tickets, access conversations, and engage with customers.',
  readme: 'hub.md',
  configuration,
  states,
  channels,
  user,
  actions,
  events,
  secrets: sentryHelpers.COMMON_SECRET_NAMES,
  entities: {
    hitlTicket: {
      schema: sdk.z.object({
        priority: sdk.z
          .enum(['low', 'normal', 'high', 'urgent'])
          .title('Ticket Priority')
          .describe('Priority of the ticket. Leave empty for default priority.')
          .optional(),
        viaChannel: sdk.z
          .string()
          .title('Via Channel')
          .describe(
            'Via Channel to use (example: "whatsapp", "instagram_dm" ), only use values documented by Zendesk, check the "Info" tab at the Zendesk integration configuration page for more details. Leave empty or use an invalid channel type and you will get "API".'
          )
          .optional(),
      }),
    },
  },
}).extend(hitl, (self) => ({
  entities: {
    hitlSession: self.entities.hitlTicket,
  },
  channels: {
    hitl: {
      title: 'Zendesk Ticket',
      conversation: {
        tags: {
          id: {
            title: 'Zendesk Ticket ID',
          },
        },
      },
      message: {
        tags: {
          zendeskCommentId: {
            title: 'Zendesk Comment ID',
            description: 'The ID of the comment in Zendesk',
          },
        },
      },
    },
  },
}))
