import {render} from 'ink'
import {Flags} from '@oclif/core'
import axios from 'axios'

import {Command, RunWithSpinner} from '@cli/components/index.js'
import {BaseGameCommand} from '@cli/baseCommands/index.js'

import {
  Certificate as AppleCertificate,
  CertificateType as AppleCertificateType,
  Profile as AppleProfile,
  ProfileType as AppleProfileType,
} from '@cli/apple/expo.js'
import {
  getProjectCredentials,
  getUserCredentials,
  ProjectCertificate_iOS,
  uploadProjectCredentials,
  UserCertificate_iOS,
} from '@cli/api/index.js'
import {CredentialsType, Platform} from '@cli/types'
import {fetchBundleId} from '@cli/utils/index.js'

export default class GameIosProfileCreate extends BaseGameCommand<typeof GameIosProfileCreate> {
  static override args = {}

  static override description = 'Creates a Mobile Provisioning Profile in the Apple Developer Portal.'

  static override examples = ['<%= config.bin %> <%= command.id %>']

  static override flags = {
    quiet: Flags.boolean({char: 'q', description: 'Avoid output except for interactions and errors'}),
    gameId: Flags.string({char: 'g', description: 'The ID of the game'}),
    force: Flags.boolean({char: 'f'}),
  }

  public async run(): Promise<void> {
    const game = await this.getGame()
    const authState = await this.refreshAppleAuthState()
    const ctx = authState.context

    const {flags} = this
    const {force} = flags

    const projectCredentials = await getProjectCredentials(game.id)
    const projectAppleProfileCredentials = projectCredentials.filter(
      (cred) => cred.platform == Platform.IOS && cred.type == CredentialsType.CERTIFICATE,
    )

    if (projectAppleProfileCredentials.length !== 0 && !force) {
      this.error('A Mobile Provisioning Profile already exists. Use --force to overwrite it.')
    }

    const createProfile = async () => {
      if (!game.details?.iosBundleId) throw new Error('iosBundleId not found in game details')
      const {iosBundleId} = game.details

      // Profile is linked to the BundleId
      const {bundleId} = await fetchBundleId({ctx, iosBundleId})
      if (!bundleId) throw new Error('BundleId not found')

      // It is also linked to the iOS Distribution Certificate
      const appleCerts = await AppleCertificate.getAsync(ctx, {
        query: {
          filter: {
            certificateType: [AppleCertificateType.DISTRIBUTION, AppleCertificateType.IOS_DISTRIBUTION],
          },
        },
      })

      // Find the apple cert which we can user
      const userCerts = await getUserCredentials()
      const validCert = userCerts.find(
        (cred) => cred.platform === Platform.IOS && cred.type === CredentialsType.CERTIFICATE && cred.isActive == true,
      )

      const validAppleCert = appleCerts.find(
        (cert) => validCert && cert.attributes.serialNumber === validCert.serialNumber,
      )

      if (!validCert || !validAppleCert)
        throw new Error(
          'No usable iOS Distribution Certificate found. Please run "shipthis apple certificate create" first.',
        )

      // Create the profile
      // TODO: only one of these can exist per bundleId - if forcing, should/can we disable existing ones?
      const profile = await AppleProfile.createAsync(ctx, {
        bundleId: bundleId.id,
        certificates: [validAppleCert.id],
        devices: [],
        name: `ShipThis Profile for ${iosBundleId}`,
        profileType: AppleProfileType.IOS_APP_STORE,
      })

      // Save the profile as a project credential. In this case we include the
      // user credential in the content for the project credential. TODO: rethink??
      const {data: contents} = await axios({
        method: 'get',
        url: validCert.url,
      })
      const userCertContent = contents as UserCertificate_iOS

      const projectCertContent: ProjectCertificate_iOS = {
        ...userCertContent,
        mobileProvisionBase64: `${profile.attributes.profileContent}`,
      }
      await uploadProjectCredentials(game.id, {
        contents: projectCertContent,
        platform: Platform.IOS,
        type: CredentialsType.CERTIFICATE,
        serialNumber: validCert.serialNumber,
        identifier: iosBundleId,
      })
    }

    const handleComplete = async () => {
      await this.config.runCommand('game:ios:profile:status', ['--gameId', game.id])
    }

    if (this.flags.quiet) return await createProfile()

    render(
      <Command command={this}>
        <RunWithSpinner
          msgInProgress="Creating Mobile Provisioning Profile in the Apple Developer Portal"
          msgComplete="Mobile Provisioning Profile created"
          executeMethod={createProfile}
          onComplete={handleComplete}
        />
      </Command>,
    )
  }
}
