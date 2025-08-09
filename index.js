// this is my resturant management server code
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
// firebase private kay
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8')
const serviceAccount = JSON.parse(decoded)
// firebase private kay
const app = express();
// middleware
app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// this is token verify
const verifyFireBaseToken = async(req, res, next)=>{
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({message: 'unauthorized access'})
  }
  const token = authHeader.split(' ')[1];
  try{
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded =decoded;
    next()
  }
  catch(error){
    return res.status(401).send({message: 'unauthorized access'})
  }

}
// this is token verify
// this is token email verify
const verifyTokenEmail = (req, res, next)=>{
  if (req.query.email !== req.decoded.email) {
      return res.status(403).message({message: 'forbidden access'})
  }
  next()
}
// this is token email verify
async function run() {
  try {
    const database = client.db("restaurant-store");
    const foodsCollection = database.collection("foods");
    const ordersCollection = database.collection("orders");
// my all foods api and routs here
    app.get("/all_foods", async (req, res) => {
      const { searchparams } = req.query;
      let query = {};
      if (searchparams) {
        query = { food_name: { $regex: searchparams, $options: "i" } };
      }
      const allFood = await foodsCollection.find(query).toArray();
      res.send(allFood);
    });

    app.get("/my_foods", verifyFireBaseToken, verifyTokenEmail, async(req, res)=>{
      const email = req.query.email;
      const query = {email: email}
      const result = await foodsCollection.find(query).toArray();
      res.send(result)
    })

    app.get("/top_foods", async (req, res) => {
      const result = await foodsCollection
        .find()
        .sort({ purchase_count: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.findOne(query);
      res.send(result);
    });

    app.put("/update_food/:id", verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const foodsData = req.body;
      const quantity = foodsData.quantity;
      foodsData.quantity = parseInt(quantity);
      const price = foodsData.price;  
      foodsData.price = parseInt(price);
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedData = req.body;
      const updatedDoc = {
        $set: updatedData,
      };
      const result = await foodsCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.delete("/delete_food/:id",verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/add_foods", verifyFireBaseToken, async (req, res) => {
      const foodsData = req.body;
      const quantity = foodsData.quantity;
      foodsData.quantity = parseInt(quantity);
      const price = foodsData.price;
      foodsData.price = parseInt(price);
      const result = await foodsCollection.insertOne(foodsData);
      res.send(result);
    });
    // my all foods api and routs here

    // all orders foods api and routes
    app.get("/all_orders", verifyFireBaseToken,verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.buyer_email = email;
      }
      const allOrders = await ordersCollection.find(query).toArray();
      res.send(allOrders);
    });

    app.delete("/delete_order/:id", verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

app.post("/order/:foodId", verifyFireBaseToken, async (req, res) => {
  const id = req.params.foodId;
  const orderData = req.body;
  const { buyer_email, order_quantity } = orderData;

  const orderQuantity = parseInt(order_quantity, 10);
  if (!orderQuantity || orderQuantity <= 0) {
    return res.status(400).send({ error: "Invalid order quantity" });
  }
  const food = await foodsCollection.findOne({ _id: new ObjectId(id) });
  if (!food) {
    return res.status(404).send({ error: "Food not found" });
  }
  if (food.quantity < orderQuantity) {
    return res.status(400).send({ error: "Not enough stock available" });
  }

  const existingOrder = await ordersCollection.findOne({
    product_id: id,
    buyer_email: buyer_email,
  });

  let result;

  if (existingOrder) {
    result = await ordersCollection.updateOne(
      { _id: existingOrder._id },
      {
        $inc: {
          order_quantity: orderQuantity,
        },
        $set: {
          date: Date.now(),
        },
      }
    );
  } else {
    const newOrder = {
      ...orderData,
      order_quantity: orderQuantity,
      product_id: id,
      date: Date.now(),
    };

    result = await ordersCollection.insertOne(newOrder);
  }

  if (result.acknowledged || result.modifiedCount > 0) {
    await foodsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: {
          quantity: -orderQuantity,
          purchase_count: orderQuantity,
        },
      }
    );
  }

  res.send(result);
});

  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("My Resturant Server is Running");
});

app.listen(port, () => {
  console.log("server running", port);
});
