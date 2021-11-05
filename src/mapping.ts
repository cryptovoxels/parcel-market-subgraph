import {
  BigInt,
  BigDecimal,
  Address,
  log,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  WyvernExchange,
  OrderApprovedPartOne,
  OrderApprovedPartTwo,
  OrderCancelled,
  OrdersMatched,
  OwnershipRenounced,
  OwnershipTransferred,
  AtomicMatch_Call,
} from "../generated/WyvernExchange/WyvernExchange";

import {
  Account,
  Transaction,
  SaleEvent,
  Order,
  PaymentToken,
  Parcel,
  Transfer as TransferEntity
} from "../generated/schema";
import { Weth } from "../generated/Weth/Weth";
import { Transfer } from "../generated/Parcel/Parcel";

const CRYPTOVOXELS_CONTRACT = "0x79986af15539de2db9a5086382daeda917a9cf0c";
const zeroHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000"

function isZero(hash:string):boolean {return hash == zeroHash} ;


export function handleOrderApprovedPartOne(event: OrderApprovedPartOne): void {
  // Listen only to cryptovoxels parcels transactions

  if (event.params.target.toHex() != CRYPTOVOXELS_CONTRACT) {
    return
  }
  log.warning("IS CV Event ", []);
  log.warning("orderApproved1: {}", [event.params.target.toHex()]);

  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.gasLimit = event.transaction.gasLimit;
    transaction.gasPrice = event.transaction.gasPrice;
    transaction.gasUsed = event.block.gasUsed;
  }
  transaction.block = event.block.number;
  transaction.date = event.block.timestamp;
  transaction.from = event.transaction.from.toHex().toLowerCase();
  transaction.save();

  let maker = Account.load(event.params.maker.toHex().toLowerCase());
  if (maker === null) {
    maker = new Account(event.params.maker.toHex().toLowerCase());
    maker.save()
  }

  let taker = Account.load(event.params.taker.toHex().toLowerCase());
  if (taker === null) {
    taker = new Account(event.params.taker.toHex().toLowerCase());
    taker.save()
  }

  let feeRecipient = Account.load(event.params.feeRecipient.toHex().toLowerCase());
  if (feeRecipient === null) {
    feeRecipient = new Account(event.params.feeRecipient.toHex().toLowerCase());
    feeRecipient.save()
  }

   /* Create/Edit an order ONLY if the order is valid; i.e Not an order hash of 0000000... */
  if(isZero(event.params.hash.toHexString())==false){
    let order = Order.load(event.params.hash.toHexString());
    if (order === null) {
      order = new Order(event.params.hash.toHexString());
    }
    order.invalid = false;
    order.taker = taker.id;
    order.maker = maker.id;
    order.feeRecipient = feeRecipient.id;
    order.makerRelayerFee = event.params.makerRelayerFee;
    order.takerRelayerFee = event.params.takerRelayerFee;
    order.makerProtocolFee = event.params.makerProtocolFee;
    order.takerProtocolFee = event.params.takerProtocolFee;
    order.side = event.params.side;
    order.saleKind = event.params.saleKind
    order.date =event.block.timestamp;
  
    order.exchangeAddress = event.params.exchange.toHex();
    order.save()
  }


}

export function handleOrderApprovedPartTwo(event: OrderApprovedPartTwo): void {

  let order = Order.load(event.params.hash.toHexString());
  if (order === null) {
    //Missing approved part one
    return
  }
  log.warning("orderApproved2: {}", [event.params.hash.toHex()]);

  let paymentToken = getPaymentToken(event.params.paymentToken)

  let parcelId = getParcelIdFromCallData(event.params.calldata)

  let parcel = Parcel.load(parcelId.toString());
  if (parcel === null) {
    parcel = new Parcel(parcelId.toString());
    parcel.numTransfers = BigInt.zero()
    parcel.save();
  }
  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.gasLimit = event.transaction.gasLimit
    transaction.gasPrice = event.transaction.gasPrice
    transaction.gasUsed = event.block.gasUsed
  }
  transaction.block = event.block.number;
  transaction.date = event.block.timestamp;
  transaction.from = event.transaction.from.toHex().toLowerCase();
  transaction.save();
   /* Create/Edit an order ONLY if the order is vali; i.e Not an order hash of 0000000... */
  if(isZero(event.params.hash.toHexString())==false){
    
    let order = Order.load(event.params.hash.toHexString());
    if (order === null) {
      order = new Order(event.params.hash.toHexString());
    }
    
    order.basePrice = event.params.basePrice;
    order.calldata = event.params.calldata;
    order.expirationTime = event.params.expirationTime;
    order.staticTarget = event.params.staticTarget.toHex();
    order.listingTime = event.params.listingTime;
    order.howToCall = event.params.howToCall;
    order.extra = event.params.extra;
    order.paymentToken = paymentToken.id;
    order.salt = event.params.salt;
    order.invalid = false
    order.parcel = parcel.id
    order.save();
  }



}

export function handleOrderCancelled(event: OrderCancelled): void {
  let order = Order.load(event.params.hash.toHex());
  if (order === null) {
    // no order
    return;
  }

  order.invalid = true;
  order.save();
}

export function handleOrdersMatched(event: OrdersMatched): void {

  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    log.info('Transaction unknown, skipping',[])
    return
  }
  log.warning("Order matched transaction: {}", [event.transaction.hash.toHex()]);


  let saleEvent = SaleEvent.load(event.transaction.hash.toHex());
  if (saleEvent == null) {
    saleEvent = new SaleEvent(event.transaction.hash.toHex());
  }

  let maker = Account.load(event.params.maker.toHex().toLowerCase());
  if (maker === null) {
    maker = new Account(event.params.maker.toHex().toLowerCase());
    maker.save()
  }

  let taker = Account.load(event.params.taker.toHex().toLowerCase());
  if (taker === null) {
    taker = new Account(event.params.taker.toHex().toLowerCase());
    taker.save()
  }
 /* Create an order ONLY if the order is vali; i.e Not an order hash of 0000000... */
  if(isZero(event.params.sellHash.toHexString()) == false){

    let sellOrder = Order.load(event.params.sellHash.toHexString());
  
    if (sellOrder === null) {
      sellOrder = new Order(event.params.sellHash.toHexString());
      sellOrder.maker = maker.id
      sellOrder.taker = taker.id
      sellOrder.basePrice = event.params.price
    }

    saleEvent.sellOrder = sellOrder.id;
    sellOrder.invalid = true;
    sellOrder.save();
  }

 /* Create an order ONLY if the order is vali; i.e Not an order hash of 0000000... */
  if(isZero(event.params.buyHash.toHexString()) == false){

    let buyOrder = Order.load(event.params.buyHash.toHexString());
    if (buyOrder === null) {
      buyOrder = new Order(event.params.buyHash.toHexString());

      buyOrder.maker = maker.id
      buyOrder.taker = taker.id
      buyOrder.basePrice = event.params.price
    }

    saleEvent.buyOrder = buyOrder.id;
    buyOrder.invalid = true;
    buyOrder.save();
  }


  let transfer = TransferEntity.load(event.transaction.hash.toHex());
  if (transfer == null) {
    transfer = new TransferEntity(event.transaction.hash.toHex());
  }
  
  saleEvent.maker = maker.id;
  saleEvent.taker = taker.id;
  saleEvent.price = event.params.price;
  saleEvent.transfer =transfer.id
  saleEvent.date =event.block.timestamp;
  saleEvent.nthTradeOfParcel = transfer.nthTradeOfParcel
  saleEvent.save();

  transfer.saleEvent = saleEvent.id
  transfer.transaction = transaction.id
  transfer.date = event.block.timestamp;
  transfer.save()

  transaction.gasLimit = event.transaction.gasLimit;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.gasUsed = event.block.gasUsed;
  transaction.block = event.block.number;
  transaction.date = event.block.timestamp;
  transaction.from = event.transaction.from.toHex().toLowerCase()
  transaction.save();

}

export function handleOwnershipRenounced(event: OwnershipRenounced): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleAtomicMatch(event: AtomicMatch_Call): void {
  let addrs = event.inputValues[0].value.toAddressArray();
  let uints = event.inputValues[1].value.toBigIntArray();
  let feeMethodsSidesKindsHowToCalls = event.inputValues[2].value.toI32Array();

  if (addrs[4].toHex() != CRYPTOVOXELS_CONTRACT) {
    return
  }
  log.warning("IS CV CALL ", []);
  log.warning("tx: {}", [event.transaction.hash.toHex()]);

  // BUY
  let makerBuy = Account.load(addrs[1].toHex().toLowerCase());
  if (makerBuy === null) {
    makerBuy = new Account(addrs[1].toHex().toLowerCase());
  }

  let takerBuy = Account.load(addrs[2].toHex().toLowerCase());
  if (takerBuy === null) {
    takerBuy = new Account(addrs[2].toHex().toLowerCase());
  }
  // Sell
  let makerSell = Account.load(addrs[7].toHex().toLowerCase());
  if (makerSell === null) {
    makerSell = new Account(addrs[7].toHex().toLowerCase());
  }

  let takerSell = Account.load(addrs[8].toHex().toLowerCase());
  if (takerSell === null) {
    takerSell = new Account(addrs[8].toHex().toLowerCase());
  }

  let feeRecipient = Account.load(addrs[3].toHex().toLowerCase());
  if (feeRecipient === null) {
    feeRecipient = new Account(addrs[3].toHex().toLowerCase());
  }

  let target = addrs[4].toHex();
  let staticTarget = addrs[5].toHex();

  // Generate an ERC20 paymentToken
  let paymentTokenBuy = getPaymentToken(addrs[6])
  let paymentTokenSell = getPaymentToken(addrs[13])

  // let exchange = WyvernExchange.bind(
  //   Address.fromString("0x7be8076f4ea4a4ad08075c2508e481d6c946d12b")
  // );

  let exchangeAddress = addrs[0];

  let makerRelayerFeeBuy = uints[0];
  let makerRelayerFeeSell = uints[9];

  let takerRelayerFeeBuy = uints[1];
  let takerRelayerFeeSell = uints[10];

  let makerProtocolFeeBuy = uints[2];
  let makerProtocolFeeSell = uints[11];

  let takerProtocolFeeBuy = uints[3];
  let takerProtocolFeeSell = uints[12];

  let basePriceBuy = uints[4];
  let basePriceSell = uints[13];

  let extraBuy = uints[5];
  let extraSell = uints[14];

  let listingTimeBuy = uints[6];
  let listingTimeSell = uints[15];

  let expirationTimeBuy = uints[7];
  let expirationTimeSell = uints[16];

  let saltBuy = uints[8];
  let saltSell = uints[17];

  let addressesBuy: Array<Address> = [];
  addressesBuy.push(addrs[0]);
  addressesBuy.push(addrs[1]);
  addressesBuy.push(addrs[2]);
  addressesBuy.push(addrs[3]);
  addressesBuy.push(addrs[4]);
  addressesBuy.push(addrs[5]);
  addressesBuy.push(addrs[6]);

  let addressesSell: Array<Address> = [];
  addressesSell.push(addrs[7]);
  addressesSell.push(addrs[8]);
  addressesSell.push(addrs[9]);
  addressesSell.push(addrs[10]);
  addressesSell.push(addrs[11]);
  addressesSell.push(addrs[12]);
  addressesSell.push(addrs[13]);

  let uintsBuy: Array<BigInt> = [];
  uintsBuy.push(uints[0]);
  uintsBuy.push(uints[1]);
  uintsBuy.push(uints[2]);
  uintsBuy.push(uints[3]);
  uintsBuy.push(uints[4]);
  uintsBuy.push(uints[5]);
  uintsBuy.push(uints[6]);
  uintsBuy.push(uints[7]);
  uintsBuy.push(uints[8]);

  let uintsSell: Array<BigInt> = [];
  uintsSell.push(uints[9]);
  uintsSell.push(uints[10]);
  uintsSell.push(uints[11]);
  uintsSell.push(uints[12]);
  uintsSell.push(uints[13]);
  uintsSell.push(uints[14]);
  uintsSell.push(uints[15]);
  uintsSell.push(uints[16]);
  uintsSell.push(uints[17]);

  let feeMethodBuy = feeMethodsSidesKindsHowToCalls[0];
  let feeMethodSell = feeMethodsSidesKindsHowToCalls[4];

  let sideBuy = feeMethodsSidesKindsHowToCalls[1];
  let sideSell = feeMethodsSidesKindsHowToCalls[5];

  let saleKindBuy = feeMethodsSidesKindsHowToCalls[2];
  let saleKindSell = feeMethodsSidesKindsHowToCalls[6];

  let howToCallBuy = feeMethodsSidesKindsHowToCalls[3];
  let howToCallSell = feeMethodsSidesKindsHowToCalls[7];

  let callDataBuy = event.inputValues[3].value.toBytes();
  let callDataSell = event.inputValues[4].value.toBytes();

  let replacementPatternBuy = event.inputValues[5].value.toBytes();
  let replacementPatternSell = event.inputValues[6].value.toBytes();

  let staticExtradataBuy = event.inputValues[7].value.toBytes();
  let staticExtradataSell = event.inputValues[8].value.toBytes();

  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.gasLimit = event.transaction.gasLimit
    transaction.gasPrice = event.transaction.gasPrice;
    transaction.gasUsed = event.block.gasUsed;
    transaction.block = event.block.number;
    transaction.date = event.block.timestamp;
    transaction.from = event.transaction.from.toHex().toLowerCase()
    transaction.save()
  }

  let saleEvent = SaleEvent.load(event.transaction.hash.toHex());
  if (saleEvent == null) {
    saleEvent = new SaleEvent(event.transaction.hash.toHex());
  }

  let parcelIdBuy = getParcelIdFromCallData(callDataBuy)
  let parcelIdSell = getParcelIdFromCallData(callDataSell)

  let parcel = Parcel.load(parcelIdBuy.toString());
  if (parcel === null) {
    parcel = new Parcel(parcelIdBuy.toString());
    parcel.numTransfers = BigInt.zero()
    parcel.save();
  }

  let parcelSell = Parcel.load(parcelIdSell.toString());
  if (parcelSell === null) {
    parcelSell = new Parcel(parcelIdSell.toString());
    parcel.numTransfers = BigInt.zero()
    parcelSell.save()
  }

  saleEvent.nthTradeOfParcel = parcel.numTransfers
  saleEvent.parcel = parcel.id
  saleEvent.save()

  let order = saleEvent.buyOrder || zeroHash as string
   /* Create/Edit an order ONLY if the order is valid; i.e Not an order hash of 0000000... */
   if(order === null){
  order = zeroHash 
  }

  if(isZero(order)==false){

    let buyOrder = Order.load(order);
    if(buyOrder ===null){
      buyOrder = new Order(order);
    }

    
    saleEvent.buyOrder = buyOrder.id;
    saleEvent.saleKind = saleKindBuy

    buyOrder.invalid = true;

    buyOrder.side = sideBuy;
    buyOrder.saleKind = saleKindBuy;
    buyOrder.maker = makerBuy.id;
    buyOrder.taker = takerBuy.id;
    buyOrder.staticTarget = staticTarget;
    buyOrder.target = target;
    buyOrder.takerProtocolFee = takerProtocolFeeBuy;
    buyOrder.makerProtocolFee = makerProtocolFeeBuy;
    buyOrder.makerRelayerFee = makerRelayerFeeBuy;
    buyOrder.takerRelayerFee = takerRelayerFeeBuy;
  
    buyOrder.extra = extraBuy;
    buyOrder.listingTime = listingTimeBuy;
    buyOrder.expirationTime = expirationTimeBuy;
    buyOrder.exchangeAddress = exchangeAddress.toHex();
    buyOrder.salt = saltBuy;
    buyOrder.paymentToken = paymentTokenBuy.id;
  
    buyOrder.howToCall = howToCallBuy;
    buyOrder.feeMethod = feeMethodBuy;
    buyOrder.basePrice = basePriceBuy;
    buyOrder.parcel = parcel.id;
    buyOrder.date =event.block.timestamp;
    buyOrder.save()
  }

  // exchange.hashOrder_(
  //   addressesBuy,
  //   uintsBuy,
  //   feeMethodBuy,
  //   sideBuy,
  //   saleKindBuy,
  //   howToCallBuy ,
  //   callDataBuy,
  //   replacementPatternBuy,
  //   staticExtradataBuy
  // );


  let orderSell = saleEvent.sellOrder || zeroHash as string
   /* Create/Edit an order ONLY if the order is valid; i.e Not an order hash of 0000000... */
   if(orderSell === null){
  orderSell=zeroHash 
  }

  if( isZero(orderSell)==false){

    let sellOrder = Order.load(orderSell); // will likely exist
    if(sellOrder ===null){
      sellOrder = new Order(orderSell);
    }
    saleEvent.sellOrder = sellOrder.id;
    saleEvent.saleKind = saleKindSell

    sellOrder.side = sideSell;
    sellOrder.saleKind = saleKindSell;
    sellOrder.maker = makerSell.id;
    sellOrder.taker = takerSell.id;
    sellOrder.staticTarget = staticTarget;
    sellOrder.target = target;
    sellOrder.takerProtocolFee = takerProtocolFeeSell;
    sellOrder.makerProtocolFee = makerProtocolFeeSell;
    sellOrder.makerRelayerFee = makerRelayerFeeSell;
    sellOrder.takerRelayerFee = takerRelayerFeeSell;
  
    sellOrder.extra = extraSell;
    sellOrder.listingTime = listingTimeSell;
    sellOrder.expirationTime = expirationTimeSell;
    sellOrder.exchangeAddress = exchangeAddress.toHex();
    sellOrder.salt = saltSell;
    sellOrder.paymentToken = paymentTokenSell.id;
    sellOrder.howToCall = howToCallSell;
    sellOrder.invalid = true;
    sellOrder.feeMethod = feeMethodSell;
    sellOrder.basePrice = basePriceSell;
    sellOrder.parcel = parcelSell.id;
    sellOrder.date =event.block.timestamp;

    sellOrder.save()
  
  }

  saleEvent.save()
}

export function handleParcelTransfer(event: Transfer): void {
  log.warning("Parcel transfer; transaction: {}", [event.transaction.hash.toHex()]);

  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.gasLimit = event.transaction.gasLimit;
    transaction.gasPrice = event.transaction.gasPrice;
    transaction.gasUsed = event.block.gasUsed;
    transaction.block = event.block.number;
    transaction.date = event.block.timestamp;
    transaction.from = event.transaction.from.toHex().toLowerCase()
    transaction.save()
  }
  

  let transfer = TransferEntity.load(event.transaction.hash.toHex());
  if (transfer == null) {
    transfer = new TransferEntity(event.transaction.hash.toHex());
  }

  transfer.transaction = transaction.id

  let parcel = Parcel.load(event.params._tokenId.toString());
  if (parcel === null) {
    parcel = new Parcel(event.params._tokenId.toString());
    parcel.numTransfers = BigInt.zero()
    parcel.save()
  }

  let sender = Account.load(event.params._from.toHex().toLowerCase());
  if (sender == null) {
    sender = new Account(event.params._from.toHex().toLowerCase());
    sender.save()
  }

  let owner = Account.load(event.params._to.toHex().toLowerCase());
  if (owner == null) {
    owner = new Account(event.params._to.toHex().toLowerCase());
    owner.save()
  }

  // increase the number of transfer for that parcel

  let p = parcel.numTransfers
  if(p === null){
    p = BigInt.zero()
  }
  let transferNumber = p.plus(BigInt.fromI32(1))
  parcel.numTransfers = transferNumber
  

  transfer.from = sender.id
  transfer.to = owner.id
  transfer.parcel = parcel.id;
  transfer.date = event.block.timestamp;

  transfer.nthTradeOfParcel = transferNumber
  
  transfer.save()


  parcel.owner = owner.id;
  parcel.save()

}


function getParcelIdFromCallData(callData:Bytes):BigInt {
  
  let transferFrom = '0x23b872dd'
  let safeTransferFrom = '0x42842e0e'
  let safeTransferFromBytes = '0xb88d4fde'

  let functionCall = callData.toHexString().slice(0,10)

  let newCallData = callData
  if(functionCall.toString() == transferFrom || functionCall.toString() == safeTransferFrom || functionCall.toString() == safeTransferFromBytes){
    let hexString =  callData.toHexString().slice(10,callData.toHexString().length)
    newCallData = Bytes.fromByteArray(Bytes.fromHexString(hexString))


    let decoded = ethereum.decode("(address,address,uint256)", newCallData);

    if (decoded === null) {
      log.warning("Could not decode", []);
      return BigInt.fromI32(0)
    }
  
    let parcelId: BigInt = BigInt.fromI32(0);
    if(decoded.kind == ethereum.ValueKind.TUPLE){
      let tuple = decoded.toTuple()
      parcelId = tuple[2].toBigInt()
  
      log.warning('Decoded: Parcel id: {}',[tuple[2].toBigInt().toString()])
  
    }
  
  
    
    if (parcelId == BigInt.fromI32(0)) {
      return BigInt.fromI32(0)
    }
  
    return parcelId

  }

  return BigInt.fromI32(0)
}


function getPaymentToken(address:Address):PaymentToken{
  let paymentToken = PaymentToken.load(address.toHex());

  if(paymentToken == null){
    log.warning("paymentToken {} ", [address.toHex()]);
    if(address.toHex() == zeroAddress){
      paymentToken = new PaymentToken(zeroAddress)
      paymentToken.decimals = 18;
      paymentToken.symbol = 'ETH'
    }else{
      paymentToken = new PaymentToken(address.toHex());
      let token = Weth.bind(address);
      let callResult_decimal = token.try_decimals();
      if (callResult_decimal.reverted) {
        paymentToken.decimals = 18
      } else {
        paymentToken.decimals = callResult_decimal.value;
      }
      let callResult_symbol = token.try_symbol();
      if (callResult_symbol.reverted) {
        paymentToken.symbol = address.toHex()
      } else {
        paymentToken.symbol = callResult_symbol.value;
      }
    }
    paymentToken.save()
  }
  return paymentToken
}