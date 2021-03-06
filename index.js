const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


const serviceAccount = require('./house-keeping-service-firebase-adminsdk-sov6n-d870c78f62.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z9rhw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodeedUser = await admin.auth().verifyIdToken(token);
            req.decodeedEmail = decodeedUser.email;
        }
        catch {

        }
    }
    next()
}



async function run() {
    try {
        await client.connect();
        const database = client.db('house_keeping');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            res.json(result)
        });
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodeedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make acces' })
            }
        })
    }
    finally {
        //await client.close();
    }
}
run().catch(console.dir);

app.get('/', async (req, res) => {
    res.send('Running house Keeping server')
});
app.listen(port, () => {
    console.log('Running house Keeping server on port', port);
})
