import { type KeyringPair } from '@polkadot/keyring/types'
import { it } from 'vitest'
import { sendTransaction } from '@acala-network/chopsticks-testing'

import { Client } from '@e2e-test/networks'
import { GetBalance, Tx } from './types.js'
import { check, checkEvents, checkHrmp, checkSystemEvents, checkUmp } from '../helpers/index.js'
import { defaultAccount } from '../index.js'

export const runXcmPalletHorizontal = (
  name: string,
  setup: () => Promise<{
    fromChain: Client
    toChain: Client
    tx: Tx
    fromBalance: GetBalance
    toBalance: GetBalance

    routeChain?: Client
    fromAccount?: KeyringPair
    toAccount?: KeyringPair
    isCheckUmp?: boolean
    precision?: number
  }>,
  tearDown?: () => Promise<void>,
) => {
  it(
    name,
    async () => {
      const {
        fromChain,
        toChain,
        tx,
        fromBalance,
        toBalance,
        routeChain,
        fromAccount = defaultAccount.alice,
        toAccount = defaultAccount.alice,
        isCheckUmp = false,
        precision = 3,
      } = await setup()

      const txx = tx(fromChain, toAccount.addressRaw)
      const tx0 = await sendTransaction(txx.signAsync(fromAccount))

      await fromChain.chain.newBlock()

      await check(fromBalance(fromChain, fromAccount.address))
        .redact({ number: precision })
        .toMatchSnapshot('balance on from chain')
      await checkEvents(tx0, 'xTokens').toMatchSnapshot('tx events')

      if (isCheckUmp) {
        await checkUmp(fromChain)
          .redact({ redactKeys: /setTopic/ })
          .toMatchSnapshot('from chain ump messages')
      } else {
        await checkHrmp(fromChain)
          .redact({ redactKeys: /setTopic/ })
          .toMatchSnapshot('from chain hrmp messages')
      }

      if (routeChain) {
        await routeChain.chain.newBlock()
      }

      await toChain.chain.newBlock()

      await check(toBalance(toChain, toAccount.address))
        .redact({ number: precision })
        .toMatchSnapshot('balance on to chain')
      await checkSystemEvents(toChain, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot('to chain xcm events')

      tearDown && (await tearDown())
    },
    240000,
  )
}
