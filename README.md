# Parcel market data collector subgraph.

This subgraph subscribes to the Opensea Exchange and to the Cryptovoxels Parcel contract.

It listens to atomic matches from both buy and sell orders while listening to transfer events on the parcel contract.

It links the two events together.

A transfer is its own entity and may or may not have a saleEvent.

This subgraph is completely broken as long as https://github.com/graphprotocol/graph-ts/issues/211 is not solved.