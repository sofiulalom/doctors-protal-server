const express = require('express');
const cors =require("cors")
const { MongoClient, ServerApiVersion, ObjectId, OrderedBulkOperation } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app =express();
const port =process.env.PORT || 5000
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vxj4bij.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function veryfiJwt(req,res, next) {
        const authHeader= req.headers.authorization;

        if(!authHeader){
           return res.status(401).send('unauthorized access')
        }
        const token= authHeader.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
             if(err){
              return  res.status(403).send({message: 'Forbeden Token'})
             }
             req.decoded= decoded;
             next();
        })
    
}
async function run(){
    try{
     const appoinmetOpptionCallection= client.db('doctorsProtal').collection('appoinmentOption')
      const bookingsCollection = client.db('doctorsProtal').collection('bookings')
      const usersCollection = client.db('doctorsProtal').collection('users')
      const docotorsCollection = client.db('doctorsProtal').collection('doctors')
      const paymantsCollection= client.db('doctorsProtal').collection('paymants')
      const verifyAdmin = async(req, res ,next)=>{
         const decodedEmail=req.decoded.email;
         const query={email: decodedEmail};
         const users=await usersCollection.findOne(query);
         if(users?.role !== 'admin'){
             return res.status(403).send({message: "forbidden access"})
         }
         next();
      }
     app.get('/appoinmentOption', async(req, res)=>{
        const date=req.query.date;
        
         const query={};
         const options =await appoinmetOpptionCallection.find(query).toArray()
         const bookingquery={appoinmentDate: date};
         const allradeyBooked= await bookingsCollection.find(bookingquery).toArray()
         options.forEach(option =>{
             const  optionsBooked = allradeyBooked.filter(book => book.tritmantName === option.name);
             const bookedSlots= optionsBooked.map(book => book.slot)
             const reaminingSltos =option.slots.filter( slot => !bookedSlots.includes(slot) )
             option.slots =reaminingSltos;
            
         })
         
         res.send(options)
     });
     
     app.get('/v3/appointmentOptions', async (req, res) => {
      const date = req.query.date;
      const options = await appoinmetOpptionCallection.aggregate([
          {
              $lookup: {
                  from: 'bookings',
                  localField: 'name',
                  foreignField: 'treatment',
                  pipeline: [
                      {
                          $match: {
                              $expr: {
                                  $eq: ['$appointmentDate', date]
                              }
                          }
                      }
                  ],
                  as: 'booked'
              }
          },
          {
              $project: {
                  name: 1,
                  price: 1,
                  slots: 1,
                  booked: {
                      $map: {
                          input: '$booked',
                          as: 'book',
                          in: '$$book.slot'
                      }
                  }
              }
          },
          {
              $project: {
                  name: 1,
                  price: 1,
                  slots: {
                      $setDifference: ['$slots', '$booked']
                  }
              }
          }
      ]).toArray();
      res.send(options);
  })
     app.get('/appoinmentSpeciailty', async(req, res)=>{
        const query={};
        const result=await appoinmetOpptionCallection.find(query).project({name: 1}).toArray();
        res.send(result)
     })
     app.get('/bookings',veryfiJwt, async(req, res)=> {
         const email =req.query.email;
         const decodedEmail=req.decoded.email;
         if(email !== decodedEmail){
            return res.status(403).send({message: "forbidden access"})
         }
         const query={ email: email}
         const bookings=await bookingsCollection.find(query).toArray();
         res.send(bookings)
     });
     app.get('/bookings/:id', async(req, res)=>{
       const id =req.params.id;
       const query={_id: new ObjectId(id)};
       const result = await bookingsCollection.findOne(query);
       res.send(result)
     })

     app.post('/bookings', async(req, res)=> {
         const booking =req.body;
         const query ={
            appoinmentDate: booking.appoinmentDate,
            email: booking.email,
            tritmantName: booking.tritmantName,
         }
         const allredeyBooked= await bookingsCollection.find(query).toArray()
         if(allredeyBooked.length){
            const message=`you allready have a booking on${booking.appoinmentDate}`;
            return res.send({acknowledged: false, message})
         }
         const result =await bookingsCollection.insertOne(booking)
         res.send(result)
     })
     app.post('/create-payment-intent', async(req,res)=>{
        const booking=req.body;
        const price=booking.price;
        const amount =price *100;
        const paymentIntent= await stripe.paymentIntents.create({
         amount: amount,
         currency: 'usd',
         "payment_method_types": [
            "card"
          ],
        });
        
        res.send({
            clientSecret: paymentIntent.client_secret,
          });
     });
     app.post('/payments', async(req, res)=>{
         const paymant= req.body;
         const result =await paymantsCollection.insertOne(paymant);
         const id =paymant.bookingId;
         const filter ={ _id: new ObjectId(id)};
         const updateDoc={
            $set:{
                paid: true,
                transactionId: paymant.transactionId,
            }
         }
         const updateResult= await bookingsCollection.updateOne(filter, updateDoc)

         res.send(result)
     })
     app.get('/jwt', async(req, res)=>{
         const email=req.query.email;
         const query={email: email};
         const user=await usersCollection.findOne(query);
         if(user){
            const token= jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '2d'});
           return res.send({accessToken: token})
         }
        
         res.status(403).send({accessToken: ''})
        
     })
     
     app.get('/aponinmentSpcialty', async(req, res)=> {
         const query={};
         const result = await appoinmetOpptionCallection.find(query).project({name: 1}).toArray();
         res.send(result)
     })
     app.get('/users', async(req, res)=> {
        const query={};
        const result=await usersCollection.find(query).toArray();
        res.send(result)
     });
     app.get('/users/admin/:email', async(req, res)=>{
        const email=req.params.email;
        const query={ email };
        const user =await usersCollection.findOne(query);
        res.send({isAdmin: user?.role === 'admin'})
     })
  
     app.post('/users', async(req, res)=>{
         const users=req.body;
         const result= await usersCollection.insertOne(users)
         res.send(result)
     });
     app.put('/users/admin/:id', veryfiJwt,verifyAdmin,async(req, res)=>{
        const id =req.params.id;
        const filter={_id: new ObjectId(id)};
        const options={upsert: true};
        const updateDoc={
            $set:{
                role: 'admin'
            }
        }
        const result=await usersCollection.updateOne(filter, updateDoc, options)
        res.send(result)
     });


   //   app.get('/addprice', async(req, res)=> {
   //       const filter= {};
   //       const options={upsert: true};
   //       const updateDoc={
   //          $set:{
   //              price: 99,
   //          }
   //      }
   //      const result =await appoinmetOpptionCallection.updateMany(filter, updateDoc, options);
   //      res.send(result)
   //   })

     app.get('/doctors', veryfiJwt,verifyAdmin, async(req, res)=>{
        const query={};
        const result =await docotorsCollection.find(query).toArray();
        res.send(result)
     })
     app.post('/doctors',veryfiJwt,verifyAdmin, async(req,res)=>{
        const doctor =req.body;
        const result = await docotorsCollection.insertOne(doctor);
        res.send(result)
     });
     app.delete('/doctors/:id', veryfiJwt,verifyAdmin, async(req, res)=> {
        const  id =req.params.id;
        const query={_id: new ObjectId(id)}
        const result = await docotorsCollection.deleteOne(query);
        res.send(result)
     })

     

    }
    finally{

    }
}run().catch(console.log)



app.get('/', (req, res)=>{
     res.send('doctors protal server running')

})
app.listen(port, () => console.log(`doctors protal server port ${port}`))