import { z, IntegrationDefinition, messages } from '@botpress/sdk'
import { sentry as sentryHelpers } from '@botpress/sdk-addons'
import proactiveConversation from 'bp_modules/proactive-conversation'
import proactiveUser from 'bp_modules/proactive-user'

export const INTEGRATION_NAME = 'instagram'

// File message type unsupported both ways
const { file: _file, ...channelMessages } = messages.defaults

export default new IntegrationDefinition({
  name: INTEGRATION_NAME,
  version: '3.1.0',
  title: 'Instagram',
  description: 'Automate interactions, manage comments, and send/receive messages all in real-time.',
  icon: 'icon.svg',
  readme: 'hub.md',
  configuration: {
    identifier: {
      linkTemplateScript: 'linkTemplate.vrl',
    },
    schema: z.object({}),
  },
  configurations: {
    manual: {
      title: 'Manual Configuration',
      description: 'Configure by manually supplying the Meta app details',
      schema: z.object({
        clientSecret: z
          .string()
          .secret()
          .title('Client Secret')
          .describe('Instagram App secret from API setup View used for webhook signature check'),
        verifyToken: z
          .string()
          .secret()
          .title('Verify Token')
          .describe('Token used for verifying the Callback URL at API setup View'),
        accessToken: z
          .string()
          .secret()
          .title('Access token')
          .describe('Access Token for the Instagram Account from the API setup View'),
        instagramId: z.string().title('Instagram account ID').describe('Instagram Account Id from API setup View'),
      }),
    },
    sandbox: {
      title: 'Sandbox Configuration',
      description: 'Sandbox configuration, for testing purposes only',
      schema: z.object({}),
    },
  },
  states: {
    oauth: {
      type: 'integration',
      schema: z.object({
        accessToken: z
          .string()
          .title('Access token')
          .describe('Access token used to authenticate requests to the Instagram API'),
        instagramId: z
          .string()
          .title('Instagram account ID')
          .describe('The Instagram account ID associated with the access token'),
        expirationTime: z
          .number()
          .title('Expiration time')
          .describe('The time when the access token expires, expressed as a Unix timestamp (epoch) in milliseconds'),
      }),
    },
  },
  identifier: {
    extractScript: 'extract.vrl',
    fallbackHandlerScript: 'fallbackHandler.vrl',
  },
  channels: {
    channel: {
      title: 'Direct Message',
      description: 'Direct message conversation between an Instagram user and the bot',
      messages: channelMessages,
      message: {
        tags: {
          id: {
            title: 'Message ID',
            description: 'The Instagram message ID',
          },
          senderId: {
            title: 'Sender ID',
            description: 'The Instagram user ID of the message sender',
          },
          recipientId: {
            title: 'Recipient ID',
            description: 'The Instagram user ID of the message recipient',
          },
        },
      },
      conversation: {
        tags: {
          id: {
            title: 'Conversation ID',
            description: 'The Instagram user ID of the user in the conversation',
          },
        },
      },
    },
  },
  actions: {},
  events: {},
  secrets: {
    ...sentryHelpers.COMMON_SECRET_NAMES,
    CLIENT_ID: {
      description: 'The client ID of the OAuth Meta app.',
    },
    CLIENT_SECRET: {
      description: 'The client secret of the OAuth Meta app.',
    },
    VERIFY_TOKEN: {
      description: 'The verify token of the OAuth Meta app.',
    },
    SANDBOX_CLIENT_SECRET: {
      description: 'The client secret of the Sandbox Meta app',
    },
    SANDBOX_VERIFY_TOKEN: {
      description: 'The verify token for the Sandbox Meta App Webhooks subscription',
    },
    SANDBOX_ACCESS_TOKEN: {
      description: 'Access token for the Sandbox Meta App',
    },
    SANDBOX_INSTAGRAM_ID: {
      description: 'Instagram ID for the Sandbox Instagram profile',
    },
  },
  user: {
    tags: {
      id: {
        title: 'User ID',
        description: 'The Instagram user ID',
      },
    },
  },
  entities: {
    user: {
      title: 'User',
      description: 'An Instagram user',
      schema: z
        .object({
          id: z.string().title('ID').describe('The Instagram user ID'),
        })
        .title('User')
        .describe('The user object fields'),
    },
    dm: {
      title: 'Direct Message',
      description: 'An Instagram direct message conversation',
      schema: z
        .object({
          id: z.string().title('User ID').describe('The Instagram user ID of the user in the conversation'),
        })
        .title('Conversation')
        .describe('The conversation object fields'),
    },
  },
})
  .extend(proactiveUser, ({ entities }) => ({
    entities: {
      user: entities.user,
    },
  }))
  .extend(proactiveConversation, ({ entities }) => ({
    entities: {
      conversation: entities.dm,
    },
    actions: {
      getOrCreateConversation: { name: 'getOrCreateConversationDm' },
    },
  }))
