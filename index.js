const express = require('express');
const cors =require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
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
        })
    
}
async function run(){
    try{
     const appoinmetOpptionCallection= client.db('doctorsProtal').collection('appoinmentOption')
      const bookingsCollection = client.db('doctorsProtal').collection('bookings')
      const usersCollection = client.db('doctorsProtal').collection('users')
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
     })
     app.get('/bookings', veryfiJwt, async(req, res)=> {
         const email =req.query.email;
         const decodedEmail=req.decoded.email;
         if(email !== decodedEmail){
            return res.status(403).send({message: 'Forbeden Token'})
         }
         
         const query={ email: email}
        
         const bookings=await bookingsCollection.find(query).toArray();
         res.send(bookings)
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
     app.get('/jwt', async(req, res)=>{
         const email=req.query.email;
         const query={email: email};
         const user=await usersCollection.findOne(query);
         if(user){
            const token= jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
           return res.send({accessToken: token})
         }
        
         res.status(403).send({accessToken: ''})
        
     })
     app.get('/users/admin/:email', async(req, res)=>{
        const email=req.params.email;
        const query={email};
        const user =await usersCollection.findOne(query);
         res.send({isAdmin: user?.role === 'admin'})
     })
     app.get('/users', async(req, res)=>{
         const query={};
         const users =await usersCollection.find(query).toArray()
         res.send(users)
     })
     app.put('/users/admin/:id',veryfiJwt, async(req, res)=>{
        const decodedEmail =req.decoded.email;
        const qurey={email: decodedEmail}
         const user =await usersCollection.findOne(qurey);
         if(user?.role !== 'admin'){
            return res.status(403).send({message: 'Forbedn access'})
         }
         const id =req.params.id;
         const filter={_id: new ObjectId(id)}
         const options = { upsert: true };
         const updateDoc={
            $set:{
                role: 'admin'
            }
         };
         const result=await usersCollection.updateOne(filter, updateDoc,options);
         res.send(result)
     })
     app.post('/users', async(req, res)=>{
         const users=req.body;
         const result= await usersCollection.insertOne(users)
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