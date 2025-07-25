import {Flags} from '@oclif/core'
import {render} from 'ink'

import {CapabilityTypeOption} from '@cli/apple/expo.js'
import {BaseGameCommand} from '@cli/baseCommands/index.js'
import {Command, RunWithSpinner} from '@cli/components/index.js'
import {fetchBundleId} from '@cli/utils/index.js'

export default class GameIosAppSync extends BaseGameCommand<typeof GameIosAppSync> {
  static override args = {}

  static override description = 'Synchronies the Apple App "BundleId" with the capabilities from the local project.'

  static override examples = ['<%= config.bin %> <%= command.id %>']

  static override flags = {
    force: Flags.boolean({char: 'f'}), // not used but don't remove or the wizard breaks
    gameId: Flags.string({char: 'g', description: 'The ID of the game'}),
    quiet: Flags.boolean({char: 'q', description: 'Avoid output except for interactions and errors'}),
  }

  public async run(): Promise<void> {
    const game = await this.getGame()
    const authState = await this.refreshAppleAuthState()
    const ctx = authState.context

    if (!game.details?.iosBundleId) return this.error('Please run `shipthis game ios app create` first')
    const {iosBundleId} = game.details

    const syncCapabilities = async () => {
      const bundleQueryResponse = await fetchBundleId({ctx, iosBundleId})
      const {bundleId, capabilities: existing, projectCapabilities} = bundleQueryResponse
      if (!bundleId) return this.error('BundleId not found')
      if (!projectCapabilities) return this.error('Project capabilities not loaded')

      // TODO: any more which cant be edited?
      // TODO: important - what if they have set some manually?? (prompt for confirmation?)
      const unRemovable = new Set(['IN_APP_PURCHASE'])
      const toRemove = existing.filter((c) => !projectCapabilities.includes(c) && !unRemovable.has(c))
      const toAdd = projectCapabilities.filter((c) => !existing.includes(c))

      for (const capability of toRemove) {
        await bundleId.updateBundleIdCapabilityAsync({
          capabilityType: capability,
          option: CapabilityTypeOption.OFF,
        })
      }

      for (const capability of toAdd) {
        await bundleId.updateBundleIdCapabilityAsync({
          capabilityType: capability,
          option: CapabilityTypeOption.ON,
        })
      }
    }

    const handleComplete = async () => {
      await this.config.runCommand('game:ios:app:status', ['--gameId', game.id])
    }

    if (this.flags.quiet) return await syncCapabilities()

    render(
      <Command command={this}>
        <RunWithSpinner
          executeMethod={syncCapabilities}
          msgComplete="App Store BundleId capabilities synced"
          msgInProgress="Syncing App Store BundleId capabilities"
          onComplete={handleComplete}
        />
      </Command>,
    )
  }
}
