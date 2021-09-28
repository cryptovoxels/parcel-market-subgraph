# Parcel market data collector subgraph.

This subgraph subscribes to the Opensea Exchange and to the Cryptovoxels Parcel contract.
https://thegraph.com/legacy-explorer/subgraph/benjythebee/cryptovoxels-parcels

It listens to atomic matches from both buy and sell orders while listening to transfer events on the parcel contract.

It links the two events together.

A transfer is its own entity and may or may not have a saleEvent.

The current flow when listening is:

1. **Parcel was transferred**
- Create parcel object if non existant,
- Create transfer object
- Create transaction
2. **New Atomic match event**
- Create new SaleEvent
- Use transaction id to link to recent parcel transfer
- Add orders information and buyer / seller
3. **New atomicMatch_ Call**
- Get extra information such as price and all.


We gotta follow this issue: https://github.com/graphprotocol/graph-ts/issues/211 is not solved.

Query examples:

get first 10 orders
```
  orders(first: 10) {
    id
    invalid
    side
    saleKind
    transaction{
      date
    }
    maker {
      id
    }
    taker {
      id
    }
    basePrice
  }
  ```

get 100 saleEvents
```
{
saleEvents{
  buyOrder{
    side
    saleKind
    basePrice
    parcel{
      id
    }
    paymentToken{
      symbol
    }
    listingTime
    expirationTime
    maker{
      id
    }
    taker{
      id
    }
  }
  sellOrder{
    side
    saleKind
    basePrice
    parcel{
      id
    }
    paymentToken{
      symbol
    }
    listingTime
    expirationTime
    maker{
      id
    }
    taker{
      id
    }
  }
  transfer{
    from{
      id
    }
    to{
      id
    }
    date
    transaction{
      id
    }
  }
}
}

  ```