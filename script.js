        console.log("Best SaaS Starter Landing Page Loaded!");

        const filterInput = document.getElementById('filterInput');
        const freeStartersGrid = document.getElementById('free-starters-grid');
        const paidStartersGrid = document.getElementById('paid-starters-grid');
        const paginationContainer = document.getElementById('pagination-container');
        const paidPaginationContainer = document.getElementById('paid-pagination-container');
        const cardsPerPage = 12;
        let currentPage = 1;
        let paidCurrentPage = 1;
        let allFreeData = {};
        let allPaidData = {};
        let filteredFreeData = { all : [] };
        let filteredPaidData = { all : [] };
        const techFilter = document.getElementById('techFilter');
        const paidFilterInput = document.getElementById('paidFilterInput');
        const paidTechFilter = document.getElementById('paidTechFilter');


        async function loadData() {
            try{
                console.log("Starting to load data...");
                const [freeResponse, paidResponse] = await Promise.all([
                fetch('data/free-starters.json'),
                fetch('data/paid-starters.json')
            ]);

               if (!freeResponse.ok) {
                    throw new Error(`HTTP error! status: ${freeResponse.status}`);
               }

               if (!paidResponse.ok) {
                    throw new Error(`HTTP error! status: ${paidResponse.status}`);
                }

                console.log("Data fetched successfully, processing...");
                allFreeData = await freeResponse.json();
                allPaidData = await paidResponse.json();
                console.log("All Free Data:", allFreeData);
                console.log("All Paid Data:", allPaidData);
                filterAndPaginate();
                filterAndPaginatePaid();

           }catch(error){
              console.error('Failed to load data:', error);
              freeStartersGrid.innerHTML = '<p> Failed to Load data, Please try again later. </p>'
              paidStartersGrid.innerHTML = '<p> Failed to Load data, Please try again later. </p>'

            }
        }
        loadData();

       function createCards(container, data, cardClassName) {
             console.log(`Creating cards for container: ${container.id}, data:`, data, `class: ${cardClassName}`);
             container.innerHTML = '';
              const allItems = data.all || [];
             allItems.forEach(item => {
                 const card = document.createElement('div');
               card.classList.add(cardClassName);
                 card.innerHTML = `<h3>${item.name}</h3>`;
                 const description = document.createElement('p');
                description.classList.add("description");
                description.textContent = item.description;
               card.appendChild(description);
                if (container === freeStartersGrid)
                {
                    const ul = document.createElement("ul");
                    const li = document.createElement("li");
                   const a = document.createElement('a');
                     a.href = item.html_url;
                  a.textContent = item.html_url;
                   li.appendChild(a)
                      ul.appendChild(li);
                     const starsForks = document.createElement('p');
                       starsForks.classList.add("stars-forks");
                       starsForks.textContent = `Stars: ${item.stars}, Forks: ${item.forks}`;
                       card.appendChild(starsForks);
                   card.appendChild(ul);

                 } else {
                      const googleDescription = document.createElement('p');
                     googleDescription.classList.add("google-description");
                     googleDescription.textContent = item.google_description || '';
                      card.appendChild(googleDescription);
                     const domainDetails = document.createElement('p');
                    domainDetails.classList.add("domain-details");
                    domainDetails.textContent = `Domain Strength: ${item.domain_strength || 'N/A'}, Clicks: ${item.est_mo_clicks || 'N/A'}`;
                      card.appendChild(domainDetails);
                 }
                container.appendChild(card);
             });
         }

      function filterAndPaginate() {
            console.log("Starting filterAndPaginate");
            const searchTerm = filterInput.value.toLowerCase().trim();
             const selectedTech = techFilter.value;
             let filteredItems = allFreeData.all;
            console.log("Initial filtered items:", filteredItems);
             if (searchTerm !== '') {
                 filteredItems = filteredItems.filter(item =>
                    item.name.toLowerCase().includes(searchTerm) ||
                     item.description.toLowerCase().includes(searchTerm) ||
                     (Array.isArray(item.keywords) && item.keywords.some(keyword => new RegExp(searchTerm).test(keyword)))
                  );
                 console.log("Filtered after search:", filteredItems);
            }

            if(selectedTech !== ''){
                 filteredItems = filteredItems.filter(item =>
                     item.category.toLowerCase().includes(selectedTech) || (item.techstack && item.techstack.includes(selectedTech))
                );
                 console.log("Filtered after tech:", filteredItems);
           }
            filteredFreeData.all = filteredItems
          updateCards();
         renderPagination();
             console.log("Finished filterAndPaginate, filteredFreeData:", filteredFreeData);
      }

        function filterAndPaginatePaid() {
           console.log("Starting filterAndPaginatePaid");
            const searchTerm = paidFilterInput.value.toLowerCase().trim();
             const selectedTech = paidTechFilter.value;
             let filteredItems = allPaidData.all;

             console.log("Initial filtered paid items:", filteredItems);
              if (searchTerm !== '') {
                  filteredItems = filteredItems.filter(item =>
                      item.name.toLowerCase().includes(searchTerm) ||
                       (typeof item.description === 'string' && item.description.toLowerCase().includes(searchTerm)) ||
                         (Array.isArray(item.description) && item.description.some(desc => desc.toLowerCase().includes(searchTerm))) ||
                     item.google_description?.toLowerCase().includes(searchTerm) ||
                       (Array.isArray(item.keywords) && item.keywords.some(keyword => new RegExp(searchTerm).test(keyword)))
                   );
                   console.log("Filtered paid after search:", filteredItems);
               }
               if(selectedTech !== ''){
                 filteredItems = filteredItems.filter(item =>
                      item.category.toLowerCase().includes(selectedTech) || (item.techstack && item.techstack.includes(selectedTech))
                  );
                  console.log("Filtered paid after tech:", filteredItems);
               }
               filteredPaidData.all = filteredItems;
               updateCardsPaid();
              renderPaginationPaid();
            console.log("Finished filterAndPaginatePaid, filteredPaidData:", filteredPaidData);
        }

        function updateCards() {
             console.log("Starting updateCards, current page:", currentPage);
            const startIndex = (currentPage - 1) * cardsPerPage;
             const endIndex = startIndex + cardsPerPage;
           const paginatedItems = filteredFreeData.all.slice(startIndex, endIndex);
           const paginatedData = { all : paginatedItems}
             createCards(freeStartersGrid, paginatedData, 'free-starter-card')
            console.log("Finished updateCards, paginated data:", paginatedData);
       }

       function updateCardsPaid() {
           console.log("Starting updateCardsPaid, current page:", paidCurrentPage);
           const startIndex = (paidCurrentPage - 1) * cardsPerPage;
           const endIndex = startIndex + cardsPerPage;
            const paginatedItems = filteredPaidData.all.slice(startIndex, endIndex);
            const paginatedData = { all : paginatedItems}
             createCards(paidStartersGrid, paginatedData, 'paid-starter-card')
             console.log("Finished updateCardsPaid, paginated data:", paginatedData);
        }

     function renderPagination() {
            console.log("Starting renderPagination, current page:", currentPage);
            paginationContainer.innerHTML = '';
             const allItems = Object.values(filteredFreeData).flat();

           const totalPages = Math.ceil(allItems.length / cardsPerPage);
            console.log("totalPages:", totalPages)
            for (let i = 1; i <= totalPages; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                 button.disabled = i === currentPage;
               button.addEventListener('click', () => {
                     currentPage = i;
                     updateCards()
                   renderPagination();
               });
                paginationContainer.appendChild(button);
           }
            console.log("Finished renderPagination");
       }

      function renderPaginationPaid() {
           console.log("Starting renderPaginationPaid, current page:", paidCurrentPage);
             paidPaginationContainer.innerHTML = '';
           const allItems = Object.values(filteredPaidData).flat();
           const totalPages = Math.ceil(allItems.length / cardsPerPage);
            console.log("totalPages paid:", totalPages)
           for (let i = 1; i <= totalPages; i++) {
               const button = document.createElement('button');
              button.textContent = i;
                button.disabled = i === paidCurrentPage;
               button.addEventListener('click', () => {
                 paidCurrentPage = i;
                   updateCardsPaid()
                  renderPaginationPaid();
                });
             paidPaginationContainer.appendChild(button);
          }
           console.log("Finished renderPaginationPaid");
       }

       filterInput.addEventListener('input', () => {
           console.log("Filter Input changed for free starters.");
            currentPage = 1;
            filterAndPaginate()
         });

       techFilter.addEventListener('change', () => {
           console.log("Tech Filter changed for free starters.");
           currentPage = 1;
            filterAndPaginate();
        })

       paidFilterInput.addEventListener('input', () => {
           console.log("Filter Input changed for paid starters.");
           paidCurrentPage =1;
           filterAndPaginatePaid();
       });

       paidTechFilter.addEventListener('change', () => {
           console.log("Tech Filter changed for paid starters.");
         paidCurrentPage = 1;
           filterAndPaginatePaid();
        })
