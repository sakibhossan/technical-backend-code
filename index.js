const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb-legacy');

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());



function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unathorized Access' })
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }
    // console.log('decoded',decoded);
    req.decoded = decoded;
  })
  next();


}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w8b4lyk.mongodb.net/?retryWrites=true&w=majority`;



const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
  try {
    // await client.connect();
    const productsCollection = client.db('technical-product').collection('products');
    const userCollection = client.db('technical-product').collection('user');
    const orderCollection = client.db('technical-product').collection('collectOrder');
    const paymentCollection = client.db('technical-product').collection('payment');




    // json web token
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACESS_TOKEN, { expiresIn: '1d' });

      res.send({ result, token });

    });
    app.put('/user/admin/:email',  async (req, res) => {
      const email = req.params.email;
      const requesterAdmin = req.decoded.email;
      const requesterAdminAccount = await userCollection.findOne({ email: requesterAdmin });
      if (requesterAdminAccount.role === 'admin') {
        const filter = { email: email };

        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);


        res.send(result);

      }
      else {
        res.status(403).send({ message: 'forbidden' })
      }


    });
    app.patch('/collectOrder/:id',async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updateBooking = await orderCollection.updateOne(filter, updateDoc);
      res.send(updateDoc)

    })


    app.get('/products', async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
    app.get('/payment', async (req, res) => {
      const query = {};
      const cursor = paymentCollection.find(query);
      const paymentProduct = await cursor.toArray();
      res.send(paymentProduct);

    });

    app.get('/user', async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    })
    app.get('/collectOrder',verifyToken,  async (req, res) => {

      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === email) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const allProducts = await cursor.toArray();
        res.send(allProducts);
      }
      else {
        res.status(403).send({ message: 'Forbidden Access' })
      }
    })
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.send(product);

    });
    app.get('/collectOrder/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const paymentProduct = await orderCollection.findOne(query);
      res.send(paymentProduct);
    });
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    })

    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });
    app.post('/collectOrder', async (req, res) => {
      const order = req.body;
      const query = { email: order.email, product: order.product, date: order.date, productId: order.productId };
      const exist = await orderCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, order: exist });

      }
      const result = await orderCollection.insertOne(order);
      return res.send({ success: true, result });
    });
    app.post('/create-payment-intent',  async (req, res) => {
      const serviceCharge = req.body;
      const price = serviceCharge.price;

      const amount = price * 102;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        'payment_method_types': ['card']


      })
      res.send({ clientSecret: paymentIntent.client_secret, })
    });
    // --------Manage Product Delete-------//  
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    })
    app.delete('/collectOrder/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    })

  }
  finally {

  }

}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Running technical products')

});
app.listen(port, () => {
  console.log('listening to port', port);
})