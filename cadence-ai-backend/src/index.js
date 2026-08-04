// =======================================
// Cadence AI Worker
// Part 1
// CORS + Request + User Limit + System Prompt
// =======================================


export default {

  async fetch(request, env) {


    // ===============================
    // CORS
    // ===============================

    if (request.method === "OPTIONS") {

      return new Response(null, {

        headers: {

          "Access-Control-Allow-Origin": "*",

          "Access-Control-Allow-Methods": "POST",

          "Access-Control-Allow-Headers": "Content-Type"

        }

      });

    }



    // ===============================
    // Health Check
    // ===============================

    if (request.method !== "POST") {


      return new Response(

        "Cadence AI Worker is running 🚀",

        {

          headers: {

            "Access-Control-Allow-Origin": "*"

          }

        }

      );


    }



    try {


      // ===============================
      // Request Data
      // ===============================


      const {

        history,

        image,

        userId


      } = await request.json();



      if (!userId) {


        return new Response(

          JSON.stringify({

            error: "User ID missing"

          }),

          {

            status: 400,

            headers: {

              "Content-Type": "application/json",

              "Access-Control-Allow-Origin": "*"

            }

          }

        );


      }



      // ===============================
      // Daily User Limit
      // ===============================


      const DAILY_LIMIT = 50;


      const today = new Date()

        .toISOString()

        .split("T")[0];



      const usageKey =

        `usage:${userId}:${today}`;



      let usageCount =

        await env.USAGE.get(usageKey);



      usageCount = usageCount

        ? Number(usageCount)

        : 0;



      if (usageCount >= DAILY_LIMIT) {


        return new Response(

          JSON.stringify({

            error:

              "Daily message limit reached."

          }),

          {

            status: 429,

            headers: {

              "Content-Type":

                "application/json",

              "Access-Control-Allow-Origin":

                "*"

            }

          }

        );


      }





      // ===============================
      // System Prompt
      // ===============================


      const SYSTEM_PROMPT = `

You are Cadence AI, an advanced AI assistant created by Cadencea.

Identity:
- Your name is Cadence AI.
- Your creator is Shourya Sinha.
- Represent Cadencea professionally.

Behavior:
- Be helpful, friendly and accurate.
- Do not invent information.
- Explain step-by-step when needed.

Mathematics:
- Use LaTeX formatting.
- Use $ for inline math.
- Use $$ for displayed equations.

Programming:
- Provide clean readable code.
- Explain important parts.

Conversation:
- Maintain context from previous messages.
- Respect user privacy.

Response:
- Be concise for simple questions.
- Be detailed for complex topics.

`;




      // ===============================
      // Prepare Messages
      // ===============================


      const messages = history || [];



      console.log(

        "User:",

        userId

      );


      console.log(

        "Messages:",

        messages.length

      );



      // Continue in Part 2
      // ===================================
      // Gemini Request
      // ===================================


      async function askGemini() {


        const models = [

          "gemini-flash-latest",

          "gemini-2.0-flash"

        ];



        for (const model of models) {


          console.log(

            "Trying Gemini:",

            model

          );



          const contents = messages.map(msg => ({


            role: msg.role,


            parts: [

              {

                text: msg.content

              }

            ]


          }));





          // Add Image

          if (image) {


            const match = image.match(

              /^data:(.*?);base64,(.*)$/

            );



            if (match && contents.length) {


              contents[contents.length - 1]

                .parts.push({

                  inlineData: {

                    mimeType: match[1],

                    data: match[2]

                  }

                });


            }


          }





          const response = await fetch(

            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,

            {


              method: "POST",


              headers: {


                "Content-Type":

                  "application/json"


              },


              body: JSON.stringify({


                systemInstruction: {


                  parts: [

                    {

                      text: SYSTEM_PROMPT

                    }

                  ]


                },


                contents


              })


            }


          );





          const data = await response.json();





          if (

            response.ok &&

            data.candidates?.length

          ) {


            console.log(

              "Gemini success:",

              model

            );



            return data

              .candidates[0]

              .content

              .parts[0]

              .text;


          }



          console.log(

            "Gemini failed:",

            model

          );


        }



        return null;


      }







      // ===================================
      // Groq Request
      // ===================================


      async function askGroq(model) {



        console.log(

          "Trying Groq:",

          model

        );





        const groqMessages = [


          {


            role: "system",


            content: SYSTEM_PROMPT


          },


          ...messages.map(msg => ({


            role:

              msg.role === "model"

                ? "assistant"

                : msg.role,


            content:

              msg.content


          }))


        ];





        const response = await fetch(


          "https://api.groq.com/openai/v1/chat/completions",


          {


            method: "POST",


            headers: {


              "Content-Type":

                "application/json",



              "Authorization":

                `Bearer ${env.GROQ_API_KEY}`


            },


            body: JSON.stringify({


              model,


              messages: groqMessages,


              temperature: 0.7


            })


          }


        );





        const data = await response.json();





        if (

          response.ok &&

          data.choices?.length

        ) {


          console.log(

            "Groq success"

          );



          return data

            .choices[0]

            .message

            .content;


        }





        console.log(

          "Groq failed",

          data.error?.message

        );



        return null;


      }







      // ===================================
      // OpenRouter Request
      // ===================================


      async function askOpenRouter(model) {



        console.log(

          "Trying OpenRouter:",

          model

        );





        const openMessages = [


          {


            role: "system",


            content: SYSTEM_PROMPT


          },


          ...messages.map(msg => ({


            role:

              msg.role === "model"

                ? "assistant"

                : msg.role,


            content:

              msg.content


          }))


        ];





        const response = await fetch(


          "https://openrouter.ai/api/v1/chat/completions",


          {


            method: "POST",


            headers: {


              "Content-Type":

                "application/json",



              "Authorization":

                `Bearer ${env.OPENROUTER_API_KEY}`,



              "HTTP-Referer":

                "https://cadenceaofficial.github.io",



              "X-Title":

                "Cadence AI"


            },


            body: JSON.stringify({


              model,


              messages: openMessages,


              temperature: 0.7


            })


          }


        );





        const data = await response.json();





        if (

          response.ok &&

          data.choices?.length

        ) {


          console.log(

            "OpenRouter success"

          );



          return data

            .choices[0]

            .message

            .content;


        }





        console.log(

          "OpenRouter failed",

          data.error?.message

        );



        return null;


      }




      // Continue in Part 3
      // ===================================
      // MAIN AI ROUTING
      // ===================================


      let reply = null;



      if (image) {


        console.log(

          "Image request"

        );



        // 1. Gemini Vision

        reply = await askGemini();



        // 2. Groq Backup

        if (!reply) {


          reply = await askGroq(

            "llama-3.2-11b-vision-preview"

          );


        }



        // 3. OpenRouter Backup

        if (!reply) {


          reply = await askOpenRouter(

            "qwen/qwen3-vl-32b-instruct"

          );


        }



      }

      else {


        console.log(

          "Text request"

        );



        // 1. Groq

        reply = await askGroq(

          "llama-3.3-70b-versatile"

        );



        // 2. OpenRouter

        if (!reply) {


          reply = await askOpenRouter(

            "deepseek/deepseek-chat-v3.1"

          );


        }



        // 3. Coding Backup

        if (!reply) {


          reply = await askOpenRouter(

            "qwen/qwen3-coder-flash"

          );


        }



      }





      // ===================================
      // Increase User Usage Count
      // ===================================


      await env.USAGE.put(

        usageKey,

        String(usageCount + 1)

      );






      // ===================================
      // Final Response
      // ===================================


      return new Response(


        JSON.stringify({


          reply:

            reply ||

            "No response received."


        }),


        {


          headers: {


            "Content-Type":

              "application/json",



            "Access-Control-Allow-Origin":

              "*"


          }


        }


      );




    }

    catch (error) {


      console.log(

        "Worker Error:",

        error

      );



      return new Response(


        JSON.stringify({


          error:

            error.message


        }),


        {


          status:

            500,



          headers: {


            "Content-Type":

              "application/json",



            "Access-Control-Allow-Origin":

              "*"


          }


        }


      );


    }


  }

};