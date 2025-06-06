import * as client from '@botpress/client'
import * as sdk from '@botpress/sdk'
import * as fslib from 'fs'
import * as pathlib from 'path'
import * as uuid from 'uuid'
import * as apiUtils from '../../src/api'
import impl from '../../src/command-implementations'
import { ApiBot, fetchAllBots } from '../api'
import defaults from '../defaults'
import * as retry from '../retry'
import { Test, TestProps } from '../typings'
import * as utils from '../utils'

const issueSchema = sdk.z.object({
  id: sdk.z.string(),
  priority: sdk.z.enum(['high', 'medium', 'low']),
  title: sdk.z.string(),
  body: sdk.z.string(),
})
const INTEGRATION = {
  version: '0.0.1',
  title: 'An Integration',
  description: 'An integration',
  user: { tags: { id: { title: 'ID', description: 'The user ID' } } },
  configuration: { schema: sdk.z.object({}), identifier: { required: true, linkTemplateScript: '' } },
  configurations: {
    token: {
      title: 'API Token',
      description: 'The token to authenticate with',
      schema: sdk.z.object({ token: sdk.z.string() }),
    },
  },
  actions: {
    getIssue: {
      input: { schema: sdk.z.object({ id: sdk.z.string() }) },
      output: { schema: issueSchema },
    },
  },
  events: {
    issueCreated: {
      title: 'Issue Created',
      description: 'An issue was created',
      schema: issueSchema,
    },
  },
  channels: {
    issueComment: {
      title: 'Issue Comment',
      description: 'Comment on an issue',
      messages: { text: sdk.messages.defaults.text },
      conversation: { tags: { id: { title: 'ID', description: 'The issue ID' } } },
      message: { tags: { id: { title: 'ID', description: 'The issue comment ID' } } },
    },
  },
  entities: {
    issue: {
      title: 'Issue',
      description: 'An issue',
      schema: issueSchema,
    },
  },
  states: {
    lastCreatedIssue: {
      type: 'integration',
      schema: issueSchema,
    },
  },
  identifier: {
    extractScript: '',
  },
} satisfies Omit<sdk.IntegrationDefinitionProps, 'name'>

const getHomeDir = (props: { tmpDir: string }) => pathlib.join(props.tmpDir, '.botpresshome')
const initBot = async (props: TestProps, definitionFile: string) => {
  const { tmpDir, dependencies, ...creds } = props
  const argv = {
    ...defaults,
    botpressHome: getHomeDir(props),
    confirm: true,
    ...creds,
  }
  const botName = uuid.v4().replace(/-/g, '')
  const botDir = pathlib.join(tmpDir, botName)
  await impl
    .init({ ...argv, workDir: tmpDir, name: botName, type: 'bot', template: 'empty' })
    .then(utils.handleExitCode)
  await utils.fixBotpressDependencies({ workDir: botDir, target: dependencies })
  await utils.npmInstall({ workDir: botDir }).then(utils.handleExitCode)
  await fslib.promises.writeFile(pathlib.join(botDir, 'bot.definition.ts'), definitionFile)
  return { botDir }
}

// TODO: add an equivalent test with an interface once interfaces can be created by any workspace

export const addIntegration: Test = {
  name: 'cli should allow installing an integration',
  handler: async (props) => {
    const { tmpDir, workspaceHandle, logger, ...creds } = props
    const argv = {
      ...defaults,
      botpressHome: getHomeDir({ tmpDir }),
      confirm: true,
      ...creds,
    }

    const bpClient = new client.Client({
      apiUrl: creds.apiUrl,
      token: creds.token,
      workspaceId: creds.workspaceId,
      retry: retry.config,
    })

    const integrationSuffix = uuid.v4().replace(/-/g, '')
    const name = `myintegration${integrationSuffix}`
    const integrationName = `${workspaceHandle}/${name}`

    const createIntegrationBody = await apiUtils.prepareCreateIntegrationBody(
      new sdk.IntegrationDefinition({
        ...INTEGRATION,
        name: integrationName,
      })
    )

    const { integration } = await bpClient.createIntegration({
      ...createIntegrationBody,
      dev: true, // this way we ensure the integration will eventually be janitored if the test fails
      url: creds.apiUrl,
    })

    try {
      logger.info('Initializing bot')
      const { botDir } = await initBot(
        props,
        [
          'import * as sdk from "@botpress/sdk"',
          `import anIntegration from "./bp_modules/${workspaceHandle}-${name}"`,
          'export default new sdk.BotDefinition({}).addIntegration(anIntegration, {',
          '  enabled: true,',
          '  configurationType: null,',
          '  configuration: {},',
          '})',
        ].join('\n')
      )

      logger.info('Logging in')
      await impl.login(argv).then(utils.handleExitCode)

      logger.info('Installing integration')
      await impl
        .add({
          ...argv,
          packageType: undefined,
          installPath: botDir,
          packageRef: integration.id,
          useDev: false,
        })
        .then(utils.handleExitCode)

      logger.info('Building bot')
      await impl.build({ ...argv, workDir: botDir }).then(utils.handleExitCode)
      await utils.tscCheck({ workDir: botDir }).then(utils.handleExitCode)
    } finally {
      await impl.integrations.subcommands
        .delete({
          ...argv,
          integrationRef: integration.id,
        })
        .catch(() => {
          logger.warn(`Failed to delete integration ${integration.id}`) // this is not the purpose of the test
        })
    }
  },
}

export const addPlugin: Test = {
  name: 'cli should allow installing a plugin',
  handler: async (props) => {
    const { tmpDir, workspaceHandle, logger, ...creds } = props
    const argv = {
      ...defaults,
      botpressHome: getHomeDir({ tmpDir }),
      confirm: true,
      ...creds,
    }

    const bpClient = new client.Client({
      apiUrl: creds.apiUrl,
      token: creds.token,
      workspaceId: creds.workspaceId,
      retry: retry.config,
    })

    const pluginSuffix = uuid.v4().replace(/-/g, '')
    const name = `myplugin${pluginSuffix}`
    const pluginName = `${workspaceHandle}/${name}`
    const pluginVersion = '0.1.0'
    const pluginAlias = `alias-${uuid.v4().replace(/-/g, '')}`
    const botName = uuid.v4()

    const createPluginBody = await apiUtils.prepareCreatePluginBody(
      new sdk.PluginDefinition({
        name: pluginName,
        version: pluginVersion,
      })
    )

    const { plugin } = await bpClient.createPlugin({
      ...createPluginBody,
      code: { browser: 'export default {}', node: 'export default {}' },
    })

    let bot: ApiBot | undefined

    try {
      logger.info('Initializing bot')
      const { botDir } = await initBot(
        props,
        [
          'import * as sdk from "@botpress/sdk"',
          `import aPlugin from "./bp_modules/${workspaceHandle}-${name}"`,
          'export default new sdk.BotDefinition({}).addPlugin(aPlugin, {',
          `  alias: '${pluginAlias}',`,
          '  configuration: {},',
          '  interfaces: {},',
          '})',
        ].join('\n')
      )

      logger.info('Logging in')
      await impl.login(argv).then(utils.handleExitCode)

      logger.info('Installing plugin')
      await impl
        .add({
          ...argv,
          packageType: undefined,
          installPath: botDir,
          packageRef: plugin.id,
          useDev: false,
        })
        .then(utils.handleExitCode)

      logger.info('Building bot')
      await impl.build({ ...argv, workDir: botDir }).then(utils.handleExitCode)
      await utils.tscCheck({ workDir: botDir }).then(utils.handleExitCode)

      logger.info('Deploying bot')
      await impl.bots.subcommands.create({ ...argv, name: botName, ifNotExists: false }).then(utils.handleExitCode)

      bot = await fetchBot(bpClient, botName)
      if (!bot) {
        throw new Error(`Bot ${botName} should have been created`)
      }

      await impl.deploy({ ...argv, workDir: botDir, createNewBot: false, botId: bot.id }).then(utils.handleExitCode)

      logger.info('Checking if plugin is installed')
      const plugins = await bpClient.getBot({ id: bot.id }).then(({ bot }) => bot.plugins)

      const isPluginInstalled = Object.entries(plugins).some(
        ([alias, instance]) => alias === pluginAlias && instance.id === plugin.id
      )

      if (!isPluginInstalled) {
        throw new Error(`Plugin ${plugin.id} should have been installed in bot ${bot.id}`)
      }
    } finally {
      if (bot) {
        await impl.bots.subcommands
          .delete({
            ...argv,
            botRef: bot.id,
          })
          .catch(() => {
            logger.warn(`Failed to delete bot ${bot!.id}`) // this is not the purpose of the test
          })
      }
      await impl.plugins.subcommands
        .delete({
          ...argv,
          pluginRef: plugin.id,
        })
        .catch(() => {
          logger.warn(`Failed to delete plugin ${plugin.id}`) // this is not the purpose of the test
        })
    }
  },
}

const fetchBot = async (client: client.Client, botName: string): Promise<ApiBot | undefined> =>
  await fetchAllBots(client).then((bots) => bots.find(({ name }) => name === botName))
