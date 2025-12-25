# Use the lightweight Nginx Alpine image
FROM nginx:alpine

# Copy the HTML file to the default Nginx public folder
COPY ./html/index.html /usr/share/nginx/html/index.html

# Expose port 80 (internal container port)
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]