package org.firstinspires.ftc.teamcode;

import com.arcrobotics.ftclib.command.CommandBase;
import com.arcrobotics.ftclib.command.SequentialCommandGroup;
import com.arcrobotics.ftclib.command.SubsystemBase;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.util.ElapsedTime;
import com.pedropathing.follower.Follower;
import com.pedropathing.pathgen.PathChain;

// Drivetrain wraps the Pedro follower as an FTCLib subsystem
class DriveSubsystem extends SubsystemBase {
    private final Follower follower;
    public DriveSubsystem(HardwareMap hardwareMap) { follower = new Follower(hardwareMap); }
    public void followPath(PathChain path) { follower.followPath(path); }
    public boolean isBusy() { return follower.isBusy(); }
    @Override public void periodic() { follower.update(); }
}

class IntakeSubsystem extends SubsystemBase {
    private final DcMotor motor;
    public IntakeSubsystem(HardwareMap hardwareMap) { motor = hardwareMap.get(DcMotor.class, "intake"); }
    public void run(double power) { motor.setPower(power); }
}

// FollowPath finishes when the follower reports it is no longer busy
class FollowPath extends CommandBase {
    private final DriveSubsystem drive;
    private final PathChain path;
    public FollowPath(DriveSubsystem drive, PathChain path) { this.drive = drive; this.path = path; addRequirements(drive); }
    @Override public void initialize() { drive.followPath(path); }
    @Override public boolean isFinished() { return !drive.isBusy(); }
}

// RunIntake runs for a fixed duration in seconds
class RunIntake extends CommandBase {
    private final IntakeSubsystem intake;
    private final double duration;
    private final ElapsedTime timer = new ElapsedTime();
    public RunIntake(IntakeSubsystem intake, double duration) { this.intake = intake; this.duration = duration; addRequirements(intake); }
    @Override public void initialize() { timer.reset(); intake.run(1.0); }
    @Override public boolean isFinished() { return timer.seconds() >= duration; }
    @Override public void end(boolean interrupted) { intake.run(0); }
}

class AutoRoutine extends SequentialCommandGroup {
    public AutoRoutine(DriveSubsystem drive, IntakeSubsystem intake, PathChain toScore, PathChain toPark) {
        addCommands(new FollowPath(drive, toScore), new RunIntake(intake, 2.0), new FollowPath(drive, toPark));
    }
}

// Comparison: the command-based version is easier to read because each step is a named command,
// and easier to modify — reordering the autonomous is one line in addCommands(). The original
// state machine needed a new enum value and switch case for every step.
