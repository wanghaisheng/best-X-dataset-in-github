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
        let filteredFreeData = {};
        let filteredPaidData = {};
        const techFilter = document.getElementById('techFilter');
         const paidFilterInput = document.getElementById('paidFilterInput');
        const paidTechFilter = document.getElementById('paidTechFilter');


          async function loadData() {
          try{
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


                  allFreeData = await freeResponse.json();
                  allPaidData = await paidResponse.json();
                filterAndPaginate();
                filterAndPaginatePaid();

            }catch(error){
               console.error('Failed to load data:', error);
                freeStartersGrid.innerHTML = '<p> Failed to Load data, Please try again later. </p>'
                  paidStartersGrid.innerHTML = '<p> Failed to Load data, Please try again later. </p>'

             }
          }
          loadData();


        function createCards(container, data) {
             container.innerHTML = '';
            const allItems = data.all || [];
              allItems.forEach(item => {
                const card = document.createElement('div');
                card.classList.add(container === freeStartersGrid ? 'free-starter-card' : 'paid-starter-card');
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
           const searchTerm = filterInput.value.toLowerCase().trim();
           const selectedTech = techFilter.value;
           let filteredItems = allFreeData.all;
           if (searchTerm !== '') {
             filteredItems = filteredItems.filter(item =>
                 item.name.toLowerCase().includes(searchTerm) ||
                   item.description.toLowerCase().includes(searchTerm) ||
                 (item.keywords && item.keywords.some(keyword => keyword.includes(searchTerm)))
               );
           }

           if(selectedTech !== ''){
               filteredItems = filteredItems.filter(item =>
                 item.category.toLowerCase().includes(selectedTech) || (item.techstack && item.techstack.includes(selectedTech))
              );
           }
           filteredFreeData.all = filteredItems
           renderPagination();
           updateCards();
        }


        function filterAndPaginatePaid() {
           const searchTerm = paidFilterInput.value.toLowerCase().trim();
              const selectedTech = paidTechFilter.value;
              let filteredItems = allPaidData.all;

              if (searchTerm !== '') {
                filteredItems = filteredItems.filter(item =>
                 item.name.toLowerCase().includes(searchTerm) ||
                   (item.description && item.description.some(desc=> desc.toLowerCase().includes(searchTerm)))||
                  item.google_description?.toLowerCase().includes(searchTerm) ||
                   (item.keywords && item.keywords.some(keyword => keyword.includes(searchTerm)))
                );
              }
               if(selectedTech !== ''){
               filteredItems = filteredItems.filter(item =>
                 item.category.toLowerCase().includes(selectedTech) || (item.techstack && item.techstack.includes(selectedTech))
                );
           }
           filteredPaidData.all = filteredItems;
          renderPaginationPaid();
           updateCardsPaid();
        }

        function updateCards() {
             const allItems = Object.values(filteredFreeData).flat();
             const startIndex = (currentPage - 1) * cardsPerPage;
           const endIndex = startIndex + cardsPerPage;
           const paginatedItems = allItems.slice(startIndex, endIndex);
            const paginatedData = { all : paginatedItems}
            createCards(freeStartersGrid, paginatedData)
        }

        function updateCardsPaid() {
             const allItems = Object.values(filteredPaidData).flat();
            const startIndex = (paidCurrentPage - 1) * cardsPerPage;
           const endIndex = startIndex + cardsPerPage;
              const paginatedItems = allItems.slice(startIndex, endIndex);
            const paginatedData = { all : paginatedItems}
            createCards(paidStartersGrid, paginatedData)
        }

    function renderPagination() {
        paginationContainer.innerHTML = '';
         const allItems = Object.values(filteredFreeData).flat();

         const totalPages = Math.ceil(allItems.length / cardsPerPage);

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
    }

    function renderPaginationPaid() {
         paidPaginationContainer.innerHTML = '';
       const allItems = Object.values(filteredPaidData).flat();
        const totalPages = Math.ceil(allItems.length / cardsPerPage);

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
    }

        filterInput.addEventListener('input', () => {
           currentPage = 1;
         filterAndPaginate()
          });

        techFilter.addEventListener('change', () => {
         currentPage = 1;
           filterAndPaginate();
         })

        paidFilterInput.addEventListener('input', () => {
           paidCurrentPage =1;
         filterAndPaginatePaid();
          });

        paidTechFilter.addEventListener('change', () => {
          paidCurrentPage = 1;
         filterAndPaginatePaid();
         })
    </script>
