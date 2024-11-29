document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Handle contact form submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Add your form submission logic here
            alert('Thank you for your message! We will get back to you soon.');
            contactForm.reset();
        });
    }

    // PayPal integration for different plans
    const plans = {
        starter: {
            price: '29.00',
            name: 'Starter Plan'
        },
        pro: {
            price: '79.00',
            name: 'Professional Plan'
        },
        enterprise: {
            price: '199.00',
            name: 'Enterprise Plan'
        }
    };

    // Render PayPal buttons for each plan
    Object.keys(plans).forEach(plan => {
        const buttonContainer = document.getElementById(`paypal-button-${plan}`);
        if (buttonContainer) {
            paypal.Buttons({
                createOrder: function(data, actions) {
                    return actions.order.create({
                        purchase_units: [{
                            description: plans[plan].name,
                            amount: {
                                value: plans[plan].price
                            }
                        }]
                    });
                },
                onApprove: function(data, actions) {
                    return actions.order.capture().then(function(details) {
                        alert('Transaction completed! Thank you for your purchase, ' + details.payer.name.given_name);
                        // Add your post-purchase logic here
                    });
                }
            }).render(buttonContainer);
        }
    });

    // Add scroll animation for features
    const features = document.querySelectorAll('.feature-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    });

    features.forEach(feature => {
        feature.style.opacity = 0;
        feature.style.transform = 'translateY(20px)';
        feature.style.transition = 'all 0.5s ease-out';
        observer.observe(feature);
    });
});
