require('dotenv').config();
const database = require('./database');
const authService = require('./services/auth-service');

async function seed() {
  console.log('🌱 Seeding database...\n');
  await database.connect();

  const fmt = d => d.toISOString().split('T')[0];
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const today = new Date();

  // Branches
  if (!database.getOne('SELECT id FROM branches LIMIT 1')) {
    database.run("INSERT INTO branches (name,name_ar,code,address,city,phone,opening_time,closing_time) VALUES (?,?,?,?,?,?,?,?)",
      ['Main Branch','الفرع الرئيسي','BR-01','123 Fitness Ave','Amman','+962-7-1234567','06:00','23:00']);
    database.run("INSERT INTO branches (name,name_ar,code,address,city,phone,opening_time,closing_time) VALUES (?,?,?,?,?,?,?,?)",
      ['Downtown Branch','فرع وسط البلد','BR-02','456 Health St','Amman','+962-7-2345678','07:00','22:00']);
    console.log('  ✅ Branches');
  }

  // Plans
  if (!database.getOne('SELECT id FROM membership_plans LIMIT 1')) {
    const plans = [
      ['Monthly Basic','شهري أساسي','Access to gym floor','standard','period',30,0,50,0,0,'monthly',0,1,30,2,0],
      ['Monthly Premium','شهري مميز','Full access + classes','standard','period',30,0,80,0,0,'monthly',0,1,30,2,0],
      ['Quarterly','ربع سنوي','3-month full access','standard','period',90,0,200,0,0,'quarterly',0,1,30,2,0],
      ['Annual','سنوي','Best value yearly','standard','period',365,0,600,0,0,'yearly',0,1,30,2,0],
      ['10 Sessions','10 حصص','10 PT sessions','standard','sessions',60,10,70,0,0,'',0,1,0,0,0],
      ['20 Sessions','20 حصة','20 PT sessions','standard','sessions',90,20,120,0,0,'',0,1,0,0,0],
      ['Trial Week','أسبوع تجريبي','7-day trial','trial','period',7,0,0,0,0,'',7,0,0,0,0],
      ['Drop-In','زيارة واحدة','Single visit','drop_in','sessions',1,1,15,0,0,'',0,0,0,0,0],
    ];
    for (const p of plans) {
      database.run(`INSERT INTO membership_plans (name,name_ar,description,plan_type,billing_type,duration_days,total_sessions,price,signup_fee,is_recurring,recurring_interval,trial_days,freeze_allowed,freeze_max_days,freeze_max_count,auto_renew) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, p);
    }
    console.log('  ✅ Plans (8 types including trial & drop-in)');
  }

  // Members
  if (!database.getOne('SELECT id FROM members LIMIT 1')) {
    const members = [
      ['M-0001','Ahmad','Khalil','أحمد','خليل','ahmad@email.com','+962-7-1111111','male','1990-05-15',1,'active','active','GYM-A1B2C3D4E5F6'],
      ['M-0002','Sara','Hassan','سارة','حسن','sara@email.com','+962-7-2222222','female','1995-08-20',1,'active','active','GYM-B2C3D4E5F6A1'],
      ['M-0003','Omar','Nasser','عمر','ناصر','omar@email.com','+962-7-3333333','male','1988-03-10',1,'active','active','GYM-C3D4E5F6A1B2'],
      ['M-0004','Lina','Mahmoud','لينا','محمود','lina@email.com','+962-7-4444444','female','1992-11-25',2,'active','active','GYM-D4E5F6A1B2C3'],
      ['M-0005','Khaled','Ali','خالد','علي','khaled@email.com','+962-7-5555555','male','1985-07-03',1,'active','at_risk','GYM-E5F6A1B2C3D4'],
      ['M-0006','Noor','Salim','نور','سالم','noor@email.com','+962-7-6666666','female','1998-01-12',1,'active','new','GYM-F6A1B2C3D4E5'],
      ['M-0007','Tariq','Haddad','طارق','حداد','','+962-7-7777777','male','2000-06-30',2,'frozen','frozen','GYM-A7B8C9D0E1F2'],
      ['M-0008','Rania','Khoury','رانيا','خوري','rania@email.com','+962-7-8888888','female','1993-09-05',1,'inactive','inactive','GYM-B8C9D0E1F2A7'],
    ];
    for (const m of members) {
      database.run(`INSERT INTO members (member_no,first_name,last_name,first_name_ar,last_name_ar,email,phone,gender,date_of_birth,branch_id,status,lifecycle_stage,qr_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, m);
    }
    database.run('INSERT INTO member_contacts (member_id,name,relationship,phone,is_emergency) VALUES (?,?,?,?,1)', [1,'Fatima Khalil','Mother','+962-7-9999999']);
    database.run('INSERT INTO member_contacts (member_id,name,relationship,phone,is_emergency) VALUES (?,?,?,?,1)', [2,'Ali Hassan','Brother','+962-7-8888888']);

    // Update visit data for some members
    database.run("UPDATE members SET last_visit_at = datetime('now','-1 day'), total_visits = 45, profile_completeness = 85 WHERE id = 1");
    database.run("UPDATE members SET last_visit_at = datetime('now','-3 days'), total_visits = 22, profile_completeness = 100 WHERE id = 2");
    database.run("UPDATE members SET last_visit_at = datetime('now'), total_visits = 67, profile_completeness = 71 WHERE id = 3");
    database.run("UPDATE members SET last_visit_at = datetime('now','-20 days'), total_visits = 8, profile_completeness = 85, risk_level = 'medium' WHERE id = 5");
    database.run("UPDATE members SET last_visit_at = NULL, total_visits = 0, profile_completeness = 57 WHERE id = 6");
    database.run("UPDATE members SET last_visit_at = datetime('now','-45 days'), total_visits = 3, risk_level = 'high' WHERE id = 8");

    // Timeline entries
    for (let i = 1; i <= 6; i++) {
      database.run("INSERT INTO member_timeline (member_id,event_type,title,description) VALUES (?,?,?,?)", [i,'registered','Member Registered','Joined GymOS']);
    }
    console.log('  ✅ Members (8 with varied statuses)');
  }

  // Trainers
  if (!database.getOne('SELECT id FROM trainers LIMIT 1')) {
    database.run("INSERT INTO trainers (first_name,last_name,phone,email,specialization,branch_id) VALUES (?,?,?,?,?,?)", ['Rami','Saleh','+962-7-6666666','rami@gym.local','Weight Training, CrossFit',1]);
    database.run("INSERT INTO trainers (first_name,last_name,phone,email,specialization,branch_id) VALUES (?,?,?,?,?,?)", ['Dana','Yousef','+962-7-7777777','dana@gym.local','Yoga, Pilates',1]);
    database.run("INSERT INTO trainers (first_name,last_name,phone,email,specialization,branch_id) VALUES (?,?,?,?,?,?)", ['Fadi','Awad','+962-7-8888888','fadi@gym.local','Boxing, Cardio',2]);
    console.log('  ✅ Trainers');
  }

  // Memberships
  if (!database.getOne('SELECT id FROM memberships LIMIT 1')) {
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,price,total_paid,payment_status,status,freeze_days_allowed,freeze_max_count,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [1,2,'Monthly Premium','standard','period',fmt(today),fmt(addDays(today,30)),80,80,'paid','active',30,2,1]);
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,price,total_paid,payment_status,status,freeze_days_allowed,freeze_max_count,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [2,1,'Monthly Basic','standard','period',fmt(addDays(today,-10)),fmt(addDays(today,5)),50,50,'paid','active',30,2,1]);
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,total_sessions,remaining_sessions,price,total_paid,payment_status,status,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [3,5,'10 Sessions','standard','sessions',fmt(today),fmt(addDays(today,60)),10,8,70,70,'paid','active',1]);
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,price,total_paid,balance_due,payment_status,status,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [4,3,'Quarterly','standard','period',fmt(today),fmt(addDays(today,90)),200,100,100,'partial','active',2]);
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,price,total_paid,payment_status,status,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [5,1,'Monthly Basic','standard','period',fmt(addDays(today,-25)),fmt(addDays(today,5)),50,0,'unpaid','active',1]);
    database.run(`INSERT INTO memberships (member_id,plan_id,plan_name,membership_type,billing_type,start_date,end_date,price,is_trial,status,branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [6,7,'Trial Week','trial','period',fmt(today),fmt(addDays(today,7)),0,1,'active',1]);
    console.log('  ✅ Memberships (6 varied)');
  }

  // Attendance
  if (!database.getOne('SELECT id FROM attendance_logs LIMIT 1')) {
    for (let d = 0; d < 14; d++) {
      const date = addDays(today, -d);
      const dateStr = date.toISOString().replace('T',' ').split('.')[0];
      const membersToday = [1,2,3].filter(() => Math.random() > 0.3);
      for (const mid of membersToday) {
        const hour = 6 + Math.floor(Math.random() * 14);
        const checkIn = `${fmt(date)} ${String(hour).padStart(2,'0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}:00`;
        const dur = 30 + Math.floor(Math.random() * 90);
        database.run("INSERT INTO attendance_logs (member_id,check_in,check_out,duration_minutes,method,branch_id) VALUES (?,?,datetime(?,'+'||?||' minutes'),?,?,?)",
          [mid, checkIn, checkIn, dur, dur, 'manual', 1]);
      }
    }
    console.log('  ✅ Attendance history (14 days)');
  }

  // Class types & schedule
  try {
    if (!database.getOne('SELECT id FROM class_types LIMIT 1')) {
      database.run("INSERT INTO class_types (name,name_ar,description,color,duration_minutes,max_capacity,branch_id) VALUES (?,?,?,?,?,?,?)",
        ['CrossFit','كروسفت','High-intensity functional training','#ef4444',60,15,1]);
      database.run("INSERT INTO class_types (name,name_ar,description,color,duration_minutes,max_capacity,branch_id) VALUES (?,?,?,?,?,?,?)",
        ['Yoga','يوغا','Mind-body connection','#8b5cf6',75,20,1]);
      database.run("INSERT INTO class_types (name,name_ar,description,color,duration_minutes,max_capacity,branch_id) VALUES (?,?,?,?,?,?,?)",
        ['Spinning','سبينينغ','Indoor cycling','#f59e0b',45,25,1]);
      database.run("INSERT INTO class_types (name,name_ar,description,color,duration_minutes,max_capacity,branch_id) VALUES (?,?,?,?,?,?,?)",
        ['Boxing','ملاكمة','Boxing fitness class','#10b981',60,12,2]);

      // Recurring schedule
      const classes = [
        [1,1,1,'',0,'07:00','08:00',20],[1,1,1,'',2,'07:00','08:00',20],[1,1,1,'',4,'07:00','08:00',20],
        [2,2,1,'',1,'18:00','19:15',20],[2,2,1,'',3,'18:00','19:15',20],
        [3,null,1,'',0,'09:00','09:45',25],[3,null,1,'',2,'09:00','09:45',25],[3,null,1,'',4,'09:00','09:45',25],
        [4,3,2,'',1,'17:00','18:00',12],[4,3,2,'',3,'17:00','18:00',12],[4,3,2,'',5,'10:00','11:00',12],
        [1,1,1,'',6,'10:00','11:00',20],[2,2,1,'',5,'08:00','09:15',20],
      ];
      for (const c of classes) {
        database.run("INSERT INTO class_schedule (class_type_id,trainer_id,branch_id,title,day_of_week,start_time,end_time,max_capacity,is_recurring) VALUES (?,?,?,?,?,?,?,?,1)", c);
      }
      console.log('  ✅ Schedule (4 class types, 13 weekly slots)');
    }
  } catch (_) {}

  // Announcements
  try {
    if (!database.getOne('SELECT id FROM announcements LIMIT 1')) {
      database.run("INSERT INTO announcements (title,title_ar,body,body_ar,type,priority,is_published,published_at,created_by) VALUES (?,?,?,?,?,?,1,datetime('now'),1)",
        ['Summer Fitness Challenge','تحدي اللياقة الصيفي','Join our 30-day fitness challenge starting next month! Prizes for top performers.','انضم لتحدي اللياقة لمدة 30 يوم!','promotion','high']);
      database.run("INSERT INTO announcements (title,title_ar,body,body_ar,type,priority,is_published,published_at,created_by) VALUES (?,?,?,?,?,?,1,datetime('now'),1)",
        ['Ramadan Hours','ساعات رمضان','During Ramadan, gym hours will be 10AM-3PM and 8PM-1AM.','خلال رمضان ساعات العمل من 10ص-3م و 8م-1ص','info','normal']);
      console.log('  ✅ Announcements');
    }
  } catch (_) {}

  console.log('\n🌱 Seeding complete!\n');
  database.close();
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
